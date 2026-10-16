import { ConfidentialClientApplication, Configuration, AuthorizationUrlRequest, AuthorizationCodeRequest } from '@azure/msal-node';
import axios from 'axios';
import { PluginConfig, HorizonUser, UserRole } from '../../../src/types';
import { pluginLogger } from '../logger';

export interface AzureADUserProfile {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  userPrincipalName: string;
  mail?: string;
  groups?: string[];
}

export class AzureADConnector {
  private config: PluginConfig;
  private msalClient: ConfidentialClientApplication | null = null;

  constructor(config: PluginConfig) {
    this.config = config;
  }

  public initialize(): void {
    const { tenantId, clientId, clientSecret } = this.config.settings || {};
    if (!tenantId || !clientId || !clientSecret) {
      pluginLogger.warn('AzureAD', 'Missing required credentials (tenantId, clientId, or clientSecret).');
      return;
    }

    const msalConfig: Configuration = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret
      }
    };

    this.msalClient = new ConfidentialClientApplication(msalConfig);
    pluginLogger.info('AzureAD', `Initialized MSAL ConfidentialClientApplication for tenant '${tenantId}'.`);
  }

  /**
   * Generates authorization URL for redirecting user to Microsoft login
   */
  public async getAuthUrl(state?: string): Promise<string> {
    if (!this.msalClient) this.initialize();
    if (!this.msalClient) throw new Error('Azure AD client not initialized');

    const redirectUri = this.config.settings?.redirectUri || 'http://localhost:5173/auth/callback';
    const authCodeUrlParameters: AuthorizationUrlRequest = {
      scopes: ['user.read', 'openid', 'profile', 'email'],
      redirectUri,
      state
    };

    return await this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
  }

  /**
   * Exchanges authorization code received in callback for tokens & profile
   */
  public async exchangeCode(code: string): Promise<{ profile: AzureADUserProfile; role: UserRole; accessToken: string }> {
    if (!this.msalClient) this.initialize();
    if (!this.msalClient) throw new Error('Azure AD client not configured');

    const redirectUri = this.config.settings?.redirectUri || 'http://localhost:5173/auth/callback';
    const tokenRequest: AuthorizationCodeRequest = {
      code,
      scopes: ['user.read', 'openid', 'profile', 'email'],
      redirectUri
    };

    const response = await this.msalClient.acquireTokenByCode(tokenRequest);
    if (!response || !response.accessToken) {
      throw new Error('Failed to acquire token from Microsoft Entra ID');
    }

    // Fetch user profile from Microsoft Graph API
    const graphRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${response.accessToken}` }
    });

    const graphData = graphRes.data;

    // Fetch user group memberships if possible
    let groups: string[] = [];
    try {
      const groupRes = await axios.get('https://graph.microsoft.com/v1.0/me/memberOf?$select=id,displayName', {
        headers: { Authorization: `Bearer ${response.accessToken}` }
      });
      groups = (groupRes.data.value || []).map((g: any) => g.displayName || g.id);
    } catch (gErr: any) {
      pluginLogger.warn('AzureAD', `Could not fetch group memberships: ${gErr.message}`);
    }

    const profile: AzureADUserProfile = {
      id: graphData.id,
      displayName: graphData.displayName || graphData.userPrincipalName,
      givenName: graphData.givenName,
      surname: graphData.surname,
      userPrincipalName: graphData.userPrincipalName,
      mail: graphData.mail || graphData.userPrincipalName,
      groups
    };

    // Determine mapped role
    const role = this.mapGroupsToRole(groups);

    return { profile, role, accessToken: response.accessToken };
  }

  /**
   * Map Entra ID security groups or fallback role
   */
  public mapGroupsToRole(userGroups: string[] = []): UserRole {
    const s = this.config.settings || {};

    const isMatch = (configuredGroup?: string) => {
      if (!configuredGroup) return false;
      const target = configuredGroup.trim().toLowerCase();
      return userGroups.some(g => g.toLowerCase() === target);
    };

    // Priority: SuperAdmin > ProductOwner > ProductLead > Management > Fallback
    if (isMatch(s.groupSuperAdmin)) return 'SuperAdmin';
    if (isMatch(s.groupProductOwner)) return 'ProductOwner';
    if (isMatch(s.groupProductLead)) return 'ProductLead';
    if (isMatch(s.groupManagement)) return 'Management';

    return (s.defaultRole as UserRole) || 'TeamMember';
  }

  /**
   * Test connection & credentials
   */
  public async testConnection(overrideSettings?: Record<string, string>): Promise<any> {
    const startTime = Date.now();
    const settings = { ...this.config.settings, ...overrideSettings };
    const { tenantId, clientId, clientSecret } = settings;

    if (!tenantId || !clientId || !clientSecret) {
      return {
        success: false,
        pingMs: 0,
        providerId: 'azure-ad',
        providerName: 'Microsoft Entra ID (Azure AD SSO)',
        clusterInfo: 'Missing Configuration',
        databaseOrPath: 'N/A',
        collectionsOrLists: [],
        error: 'Missing Tenant ID, Client ID, or Client Secret.'
      };
    }

    try {
      const appClient = new ConfidentialClientApplication({
        auth: {
          clientId,
          authority: `https://login.microsoftonline.com/${tenantId}`,
          clientSecret
        }
      });

      // Acquire app-only client credentials token as verification
      const token = await appClient.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default']
      });

      const pingMs = Math.max(1, Date.now() - startTime);

      if (token && token.accessToken) {
        pluginLogger.success('AzureAD', `Connection test successful for tenant ${tenantId} in ${pingMs}ms`);
        return {
          success: true,
          pingMs,
          providerId: 'azure-ad',
          providerName: 'Microsoft Entra ID (Azure AD SSO)',
          clusterInfo: `Tenant: ${tenantId}`,
          databaseOrPath: `App: ${clientId.substring(0, 8)}...`,
          collectionsOrLists: ['User.Read', 'GroupMember.Read.All', 'openid', 'profile'],
          message: `Successfully connected to Microsoft Entra ID tenant (${tenantId}). Client credentials verified.`,
          details: {
            tokenType: token.tokenType,
            expiresOn: token.expiresOn
          }
        };
      }
      return {
        success: false,
        pingMs,
        providerId: 'azure-ad',
        providerName: 'Microsoft Entra ID (Azure AD SSO)',
        clusterInfo: 'Failed',
        databaseOrPath: 'N/A',
        collectionsOrLists: [],
        error: 'Could not obtain verification token from Entra ID.'
      };
    } catch (err: any) {
      const pingMs = Math.max(1, Date.now() - startTime);
      return {
        success: false,
        pingMs,
        providerId: 'azure-ad',
        providerName: 'Microsoft Entra ID (Azure AD SSO)',
        clusterInfo: 'Error',
        databaseOrPath: 'N/A',
        collectionsOrLists: [],
        error: `Azure AD connection test failed: ${err.message}`
      };
    }
  }
}
