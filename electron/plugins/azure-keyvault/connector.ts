import { PublicClientApplication, ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import axios from 'axios';
import { shell } from 'electron';
import { PluginConfig } from '../../../src/types';
import { pluginLogger } from '../logger';

export interface AzureKeyVaultSecretItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  source: 'azure-keyvault';
  vaultUrl: string;
  tags?: Record<string, string>;
}

export class AzureKeyVaultConnector {
  readonly id = 'azure-keyvault';
  readonly name = 'Azure Key Vault';

  private config: PluginConfig;
  private pca?: PublicClientApplication;
  private cca?: ConfidentialClientApplication;
  private isConfidential = false;
  private tokenCache: string | null = null;
  private tokenExpiresOn: number = 0;

  constructor(config: PluginConfig) {
    this.config = config;
  }

  getVaultUrl(overrideUrl?: string): string {
    const raw = (overrideUrl || this.config.settings?.vaultUrl || '').trim();
    if (!raw) return '';
    let url = raw;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    if (!url.includes('.vault.azure.net') && !url.includes('.vault.azure.cn') && !url.includes('.vault.usgovcloudapi.net')) {
      url = url.replace(/\/+$/, '') + '.vault.azure.net';
    }
    return url.replace(/\/+$/, '');
  }

  getVaultName(): string {
    const url = this.getVaultUrl();
    try {
      const u = new URL(url);
      return u.hostname.split('.')[0] || u.hostname;
    } catch {
      return this.config.settings?.vaultUrl || 'Azure Key Vault';
    }
  }

  async initialize(overrideSettings?: Record<string, string>) {
    const settings = overrideSettings || this.config.settings || {};
    const tenantId = settings.tenantId?.trim() || 'common';
    const clientId = settings.clientId?.trim();
    const clientSecret = settings.clientSecret?.trim();
    const authType = settings.authType || (clientSecret ? 'client_secret' : 'interactive');

    if (!clientId) {
      throw new Error('Azure Key Vault requires Application (Client) ID.');
    }

    if (authType === 'client_secret' || clientSecret) {
      if (!clientSecret) {
        throw new Error('Client Secret is required for Service Principal authentication.');
      }
      this.isConfidential = true;
      const msalConfig: Configuration = {
        auth: {
          clientId,
          authority: `https://login.microsoftonline.com/${tenantId}`,
          clientSecret
        }
      };
      this.cca = new ConfidentialClientApplication(msalConfig);
      this.pca = undefined;
    } else {
      this.isConfidential = false;
      const msalConfig: Configuration = {
        auth: {
          clientId,
          authority: `https://login.microsoftonline.com/${tenantId}`
        }
      };
      this.pca = new PublicClientApplication(msalConfig);
      this.cca = undefined;
    }

    this.tokenCache = null;
    this.tokenExpiresOn = 0;
  }

  async authenticate(overrideSettings?: Record<string, string>): Promise<string> {
    if (!this.pca && !this.cca) {
      await this.initialize(overrideSettings);
    }

    const now = Date.now();
    if (this.tokenCache && this.tokenExpiresOn > now + 60000) {
      return this.tokenCache;
    }

    const scope = 'https://vault.azure.net/.default';

    if (this.isConfidential && this.cca) {
      pluginLogger.info('AzureKeyVault', 'Authenticating via Service Principal Client Credentials...');
      try {
        const result = await this.cca.acquireTokenByClientCredential({
          scopes: [scope]
        });
        if (!result?.accessToken) {
          throw new Error('Failed to acquire token via Client Credentials.');
        }
        this.tokenCache = result.accessToken;
        this.tokenExpiresOn = result.expiresOn ? result.expiresOn.getTime() : now + 3500000;
        pluginLogger.success('AzureKeyVault', `Acquired token for vault scope ${scope}`);
        return this.tokenCache;
      } catch (err: any) {
        pluginLogger.error('AzureKeyVault', `Client Credentials authentication failed: ${err.message}`);
        throw new Error(`Azure Key Vault Authentication Failed: ${err.message}`);
      }
    } else if (this.pca) {
      pluginLogger.info('AzureKeyVault', 'Authenticating via Interactive Browser OAuth2...');
      try {
        const result = await this.pca.acquireTokenInteractive({
          scopes: [scope],
          openBrowser: async (url: string) => {
            await shell.openExternal(url);
          }
        });
        if (!result?.accessToken) {
          throw new Error('Interactive login did not return an access token.');
        }
        this.tokenCache = result.accessToken;
        this.tokenExpiresOn = result.expiresOn ? result.expiresOn.getTime() : now + 3500000;
        pluginLogger.success('AzureKeyVault', `Interactive login successful for ${result.account?.username || 'user'}`);
        return this.tokenCache;
      } catch (err: any) {
        pluginLogger.error('AzureKeyVault', `Interactive authentication failed: ${err.message}`);
        throw new Error(`Azure Key Vault Interactive Login Failed: ${err.message}`);
      }
    }

    throw new Error('Azure Key Vault connector is not initialized.');
  }

  async getConnectedUser(): Promise<string> {
    const vault = this.getVaultName();
    const client = this.config.settings?.clientId
      ? `App (${this.config.settings.clientId.slice(0, 8)}...)`
      : 'Service Principal';
    return `${vault} · ${client}`;
  }

  async testConnection(overrideSettings?: Record<string, string>): Promise<any> {
    const startTime = Date.now();
    const settings = overrideSettings || this.config.settings || {};
    const vaultUrl = this.getVaultUrl(settings.vaultUrl);

    if (!vaultUrl) {
      return {
        success: false,
        pingMs: 0,
        providerId: 'azure-keyvault',
        providerName: 'Azure Key Vault',
        clusterInfo: 'Missing Vault URL',
        databaseOrPath: 'N/A',
        collectionsOrLists: [],
        error: 'Please enter a valid Key Vault name or URL (e.g. kv-corp-prod).'
      };
    }

    try {
      await this.initialize(settings);
      const token = await this.authenticate(settings);

      const res = await axios.get(`${vaultUrl}/secrets?maxresults=10&api-version=7.4`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const pingMs = Date.now() - startTime;
      const secretsRaw = Array.isArray(res.data?.value) ? res.data.value : [];
      const sampleNames = secretsRaw.map((s: any) => {
        const parts = (s.id || '').split('/secrets/');
        return parts[1] ? parts[1].split('/')[0] : s.id;
      }).filter(Boolean);

      pluginLogger.success('AzureKeyVault', `Test connection successful: ${secretsRaw.length} secret(s) found in ${pingMs}ms`);

      return {
        success: true,
        pingMs,
        providerId: 'azure-keyvault',
        providerName: 'Azure Key Vault',
        clusterInfo: this.getVaultName(),
        databaseOrPath: vaultUrl,
        collectionsOrLists: sampleNames,
        secretsCount: secretsRaw.length,
        error: undefined
      };
    } catch (err: any) {
      const pingMs = Date.now() - startTime;
      let errorMsg = err.response?.data?.error?.message || err.message || 'Failed to connect to Azure Key Vault';
      if (err.response?.status === 403) {
        errorMsg = 'Access Forbidden (403): Ensure your Service Principal has the "Key Vault Secrets User" RBAC role or "Get, List" Secret Access Policy.';
      } else if (err.response?.status === 401) {
        errorMsg = 'Unauthorized (401): Invalid Azure Client ID, Client Secret, or Tenant ID.';
      } else if (err.code === 'ENOTFOUND') {
        errorMsg = `Key Vault host not found at ${vaultUrl}. Check the vault name.`;
      }

      pluginLogger.error('AzureKeyVault', `Test connection failed (${pingMs}ms): ${errorMsg}`);

      return {
        success: false,
        pingMs,
        providerId: 'azure-keyvault',
        providerName: 'Azure Key Vault',
        clusterInfo: this.getVaultName(),
        databaseOrPath: vaultUrl,
        collectionsOrLists: [],
        error: errorMsg
      };
    }
  }

  async listSecrets(): Promise<AzureKeyVaultSecretItem[]> {
    const vaultUrl = this.getVaultUrl();
    if (!vaultUrl) throw new Error('Azure Key Vault URL is not configured.');

    const token = await this.authenticate();
    const secrets: AzureKeyVaultSecretItem[] = [];
    let nextLink: string | null = `${vaultUrl}/secrets?maxresults=25&api-version=7.4`;

    while (nextLink) {
      const res: any = await axios.get(nextLink, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      const items = Array.isArray(res.data?.value) ? res.data.value : [];
      for (const item of items) {
        const fullId: string = item.id || '';
        const namePart = fullId.split('/secrets/')[1] || '';
        const name = decodeURIComponent(namePart.split('/')[0]);

        const category = item.contentType || item.tags?.category || item.tags?.Category || 'General';
        const description = item.tags?.description || item.tags?.Description || '';
        const enabled = item.attributes?.enabled ?? true;
        const createdAt = item.attributes?.created
          ? new Date(item.attributes.created * 1000).toISOString()
          : new Date().toISOString();
        const updatedAt = item.attributes?.updated
          ? new Date(item.attributes.updated * 1000).toISOString()
          : createdAt;

        secrets.push({
          id: fullId,
          name,
          category,
          description,
          enabled,
          created_at: createdAt,
          updated_at: updatedAt,
          source: 'azure-keyvault',
          vaultUrl,
          tags: item.tags || {}
        });
      }

      nextLink = res.data?.nextLink || null;
    }

    secrets.sort((a, b) => a.name.localeCompare(b.name));
    return secrets;
  }

  async getSecretValue(secretName: string, version?: string): Promise<string> {
    const vaultUrl = this.getVaultUrl();
    if (!vaultUrl) throw new Error('Azure Key Vault URL is not configured.');

    const token = await this.authenticate();
    const cleanName = encodeURIComponent(secretName.trim());
    const versionSegment = version ? `/${encodeURIComponent(version)}` : '';
    const url = `${vaultUrl}/secrets/${cleanName}${versionSegment}?api-version=7.4`;

    pluginLogger.info('AzureKeyVault', `Fetching secret value for "${secretName}" from Key Vault...`);

    try {
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 12000
      });

      const value = res.data?.value;
      if (typeof value !== 'string') {
        throw new Error('Azure Key Vault returned empty or non-string secret payload.');
      }
      return value;
    } catch (err: any) {
      if (err.response?.status === 404) {
        throw new Error(`Secret "${secretName}" was not found in Azure Key Vault.`);
      }
      if (err.response?.status === 403) {
        throw new Error(`Access Denied (403): Service Principal lacks "Key Vault Secrets User" permission to read secret "${secretName}".`);
      }
      throw new Error(err.response?.data?.error?.message || err.message || `Failed to fetch secret "${secretName}"`);
    }
  }

  async setSecret(secretName: string, value: string, category?: string, tags?: Record<string, string>): Promise<any> {
    const vaultUrl = this.getVaultUrl();
    if (!vaultUrl) throw new Error('Azure Key Vault URL is not configured.');

    const token = await this.authenticate();
    const cleanName = encodeURIComponent(secretName.trim());
    const url = `${vaultUrl}/secrets/${cleanName}?api-version=7.4`;

    const payload: any = {
      value,
      contentType: category || 'General',
      tags: {
        category: category || 'General',
        managedBy: 'Horizon PM',
        ...(tags || {})
      }
    };

    pluginLogger.info('AzureKeyVault', `Setting secret "${secretName}" in Azure Key Vault...`);

    const res = await axios.put(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return res.data;
  }

  async deleteSecret(secretName: string): Promise<boolean> {
    const vaultUrl = this.getVaultUrl();
    if (!vaultUrl) throw new Error('Azure Key Vault URL is not configured.');

    const token = await this.authenticate();
    const cleanName = encodeURIComponent(secretName.trim());
    const url = `${vaultUrl}/secrets/${cleanName}?api-version=7.4`;

    pluginLogger.warn('AzureKeyVault', `Deleting secret "${secretName}" from Azure Key Vault...`);

    await axios.delete(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return true;
  }
}
