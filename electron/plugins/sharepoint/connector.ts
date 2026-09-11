import { PublicClientApplication, ConfidentialClientApplication, Configuration, InteractiveRequest } from '@azure/msal-node';
import axios from 'axios';
import Database from 'better-sqlite3';
import { PluginConfig } from '../../../src/types';
import { BackendProvider, DocumentUploadResult, TRACKED_ENTITIES } from '../types';
import { pluginLogger } from '../logger';

export const REQUIRED_SP_LISTS = [
  'Products',
  'Releases',
  'Tasks',
  'UATCases',
  'Interfaces',
  'APIs',
  'HRRecords',
  'ScheduleEvents',
  'ProductCustomSections',
  'Users',
  'AuditLog'
];

export const SP_ENTITY_LIST_MAP: Record<string, string> = {
  products:                'Products',
  releases:                'Releases',
  tasks:                   'Tasks',
  uat_cases:               'UATCases',
  interfaces:              'Interfaces',
  apis:                    'APIs',
  hr_records:              'HRRecords',
  schedule_events:         'ScheduleEvents',
  product_custom_sections: 'ProductCustomSections',
  users:                   'Users',
  audit_log:               'AuditLog',
};

export class SharePointConnector implements BackendProvider {
  readonly id = 'sharepoint-core';
  readonly name = 'Microsoft SharePoint Core';

  private config: PluginConfig;
  private pca!: PublicClientApplication;
  private cca!: ConfidentialClientApplication;
  private isConfidential: boolean = false;
  private tokenCache: string | null = null;
  private resolvedSiteId: string | null = null;

  constructor(config: PluginConfig) {
    this.config = config;
  }

  async initialize() {
    const tenant = this.config.settings?.tenantId?.trim() || 'common';
    const clientId = this.config.settings?.clientId?.trim();
    const clientSecret = this.config.settings?.clientSecret?.trim();

    if (!clientId) {
      throw new Error('SharePoint Client ID is required');
    }

    if (clientSecret) {
      this.isConfidential = true;
      const msalConfig: Configuration = {
        auth: {
          clientId,
          authority: `https://login.microsoftonline.com/${tenant}`,
          clientSecret
        }
      };
      this.cca = new ConfidentialClientApplication(msalConfig);
    } else {
      this.isConfidential = false;
      const msalConfig: Configuration = {
        auth: {
          clientId,
          authority: `https://login.microsoftonline.com/${tenant}`,
        }
      };
      this.pca = new PublicClientApplication(msalConfig);
    }
  }

  async authenticate(): Promise<string> {
    if (!this.pca && !this.cca) {
      await this.initialize();
    }

    // Confidential Client flow (Application permissions with client secret)
    if (this.isConfidential) {
      pluginLogger.info('SharePoint', 'Authenticating via Azure AD Client Credentials (Application Secret)...');
      try {
        const result = await this.cca.acquireTokenByClientCredential({
          scopes: ['https://graph.microsoft.com/.default']
        });
        if (!result?.accessToken) {
          throw new Error('Failed to acquire token via Client Secret credentials.');
        }
        this.tokenCache = result.accessToken;
        pluginLogger.success('SharePoint', 'Successfully acquired token via Azure Client Secret.');
        return this.tokenCache;
      } catch (err: any) {
        pluginLogger.error('SharePoint', `Client secret authentication failed: ${err.message}`);
        throw err;
      }
    }

    // Interactive Public Client flow (User delegated)
    try {
      const accounts = await this.pca.getTokenCache().getAllAccounts();
      if (accounts && accounts.length > 0) {
        const silentResult = await this.pca.acquireTokenSilent({
          account: accounts[0],
          scopes: ["Sites.ReadWrite.All", "User.Read", "Files.ReadWrite.All"]
        });
        if (silentResult?.accessToken) {
          this.tokenCache = silentResult.accessToken;
          return this.tokenCache;
        }
      }
    } catch (_) {}

    try {
      const request: InteractiveRequest = {
        scopes: ["Sites.ReadWrite.All", "User.Read", "Files.ReadWrite.All"],
        openBrowser: async (url: string) => {
          try {
            const { shell } = require('electron');
            await shell.openExternal(url);
          } catch {
            console.log('Open browser for SharePoint authentication:', url);
          }
        }
      };

      const timeoutMs = 90000;
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(
            'Authentication timed out waiting for browser sign-in. If you saw "No reply address provided", in Azure Portal go to App registrations -> Your App -> Authentication -> Add a platform -> Mobile and desktop applications -> Check "http://localhost". Alternatively, configure a Client Secret under Certificates & secrets.'
          ));
        }, timeoutMs);
      });

      const result = await Promise.race([
        this.pca.acquireTokenInteractive(request).finally(() => clearTimeout(timer)),
        timeoutPromise
      ]);

      this.tokenCache = result.accessToken;
      return this.tokenCache;
    } catch (err: any) {
      this.tokenCache = null;
      let errMsg = err.message || 'SharePoint authentication failed';
      if (
        errMsg.includes('AADSTS50011') ||
        errMsg.toLowerCase().includes('reply address') ||
        errMsg.toLowerCase().includes('redirect_uri')
      ) {
        errMsg = 'Azure AD Error: No reply address registered. In Azure Portal -> App registrations -> Your App -> Authentication -> Add a platform -> Mobile and desktop applications -> Check "http://localhost". Alternatively, use a Client Secret (requires zero reply address).';
      }
      pluginLogger.error('SharePoint', `Authentication error: ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  async getToken(): Promise<string> {
    if (this.tokenCache) return this.tokenCache;
    return this.authenticate();
  }

  private async request(method: string, endpoint: string, data?: any, customHeaders?: any): Promise<any> {
    const token = await this.getToken();
    let retries = 3;
    let delay = 1500;

    while (retries > 0) {
      try {
        const url = endpoint.startsWith('http') ? endpoint : `https://graph.microsoft.com/v1.0${endpoint}`;
        const res = await axios({
          method,
          url,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(customHeaders || {})
          },
          data
        });
        return res.data;
      } catch (err: any) {
        if (err.response && err.response.status === 429) {
          retries--;
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
        } else if (err.response && err.response.status === 401) {
          this.tokenCache = null;
          retries--;
          if (retries > 0) {
            await this.authenticate();
            continue;
          }
          throw err;
        } else {
          throw err;
        }
      }
    }
    throw new Error('SharePoint API request failed: rate limit exceeded');
  }

  async getSiteId(): Promise<string> {
    if (this.resolvedSiteId) return this.resolvedSiteId;

    const rawInput = (this.config.settings?.siteUrl || '').trim();
    if (!rawInput) {
      this.resolvedSiteId = 'root';
      return this.resolvedSiteId;
    }

    if (rawInput === 'root' || (rawInput.includes(',') && !rawInput.includes('/'))) {
      this.resolvedSiteId = rawInput;
      return this.resolvedSiteId;
    }

    try {
      if (rawInput.startsWith('http://') || rawInput.startsWith('https://')) {
        const urlObj = new URL(rawInput);
        const host = urlObj.hostname;
        const path = urlObj.pathname.replace(/\/+$/, '');
        const data = await this.request('GET', `/sites/${host}:${path}`);
        if (data?.id) {
          const siteId = String(data.id);
          this.resolvedSiteId = siteId;
          return siteId;
        }
      } else if (rawInput.startsWith('/sites/') || rawInput.startsWith('/teams/')) {
        const rootData = await this.request('GET', `/sites/root`);
        const host = rootData?.siteCollection?.hostname || new URL(rootData?.webUrl || 'https://tenant.sharepoint.com').hostname;
        const cleanPath = rawInput.replace(/\/+$/, '');
        const data = await this.request('GET', `/sites/${host}:${cleanPath}`);
        if (data?.id) {
          const siteId = String(data.id);
          this.resolvedSiteId = siteId;
          return siteId;
        }
      }
    } catch (err: any) {
      console.warn(`Could not resolve SharePoint site '${rawInput}':`, err.message);
    }

    this.resolvedSiteId = rawInput;
    return this.resolvedSiteId;
  }

  async ensureListsExist(): Promise<{ existing: string[]; created: string[]; failed: string[] }> {
    const siteId = await this.getSiteId();
    const existing: string[] = [];
    const created: string[] = [];
    const failed: string[] = [];

    let currentLists: any[] = [];
    try {
      const data = await this.request('GET', `/sites/${siteId}/lists?$select=id,name,displayName`);
      currentLists = data.value || [];
      for (const item of currentLists) {
        if (item.displayName) existing.push(item.displayName);
        if (item.name && !existing.includes(item.name)) existing.push(item.name);
      }
    } catch (err: any) {
      console.warn('Failed to query existing SharePoint lists:', err.message);
    }

    for (const listName of REQUIRED_SP_LISTS) {
      const alreadyExists = existing.some(
        name => name.toLowerCase() === listName.toLowerCase()
      );

      if (!alreadyExists) {
        try {
          await this.request('POST', `/sites/${siteId}/lists`, {
            displayName: listName,
            columns: [
              { name: 'PayloadJson', text: { allowMultipleLines: true } }
            ],
            list: { template: 'genericList' }
          });
          created.push(listName);
        } catch (err: any) {
          console.warn(`Could not auto-provision list ${listName}:`, err.message);
          failed.push(listName);
        }
      }
    }

    return { existing, created, failed };
  }

  async queryList(listName: string, filter?: string, select?: string, orderby?: string) {
    const siteId = await this.getSiteId();
    let query = `?expand=fields`;
    if (filter) query += `&$filter=${filter}`;
    if (select) query += `&$select=${select}`;
    if (orderby) query += `&$orderby=${orderby}`;

    try {
      const data = await this.request('GET', `/sites/${siteId}/lists/${listName}/items${query}`);
      return (data.value || []).map((item: any) => ({
        id: item.id,
        Created: item.createdDateTime,
        Modified: item.lastModifiedDateTime,
        ...(item.fields || {})
      }));
    } catch (err: any) {
      if (err.response?.status === 404) return [];
      throw err;
    }
  }

  async createItem(listName: string, fields: any) {
    const siteId = await this.getSiteId();
    try {
      return await this.request('POST', `/sites/${siteId}/lists/${listName}/items`, { fields });
    } catch (err: any) {
      if (err.response?.status === 404) {
        await this.ensureListsExist();
        return await this.request('POST', `/sites/${siteId}/lists/${listName}/items`, { fields });
      }
      throw err;
    }
  }

  async updateItem(listName: string, itemId: string, fields: any) {
    const siteId = await this.getSiteId();
    return await this.request('PATCH', `/sites/${siteId}/lists/${listName}/items/${itemId}/fields`, fields);
  }

  async deleteItem(listName: string, itemId: string) {
    const siteId = await this.getSiteId();
    return await this.request('DELETE', `/sites/${siteId}/lists/${listName}/items/${itemId}`);
  }

  async getConnectedUser(): Promise<string> {
    try {
      const data = await this.request('GET', `/me`);
      return data.displayName || data.userPrincipalName || data.mail || 'Connected SharePoint User';
    } catch {
      // In Client Secret / Daemon app mode, /me is not available (delegated user context only)
      const clientId = this.config.settings?.clientId || 'App';
      return `Enterprise Azure App (${clientId.slice(0, 8)}...)`;
    }
  }

  // ── BackendProvider Implementation: Data Synchronization ───────

  async pullDeltas(db: Database.Database): Promise<void> {
    for (const [entity, spList] of Object.entries(SP_ENTITY_LIST_MAP)) {
      try {
        const syncRow = db.prepare('SELECT last_sync_at FROM sync_state WHERE entity = ?').get(entity) as any;
        const since = syncRow?.last_sync_at ?? '1970-01-01T00:00:00Z';
        const filter = `Modified ge datetime'${since}'`;
        const items = await this.queryList(spList, filter);
        if (!items || items.length === 0) continue;

        const insert = db.transaction((rows: any[]) => {
          for (const row of rows) {
            let base: any = {};
            if (row.PayloadJson) {
              try { base = JSON.parse(row.PayloadJson); } catch (_) {}
            }
            const record = { ...base, sp_item_id: String(row.id || ''), updated_at: row.Modified || new Date().toISOString() };
            if (!record.id && row.Title) record.id = row.Title;

            const cols = Object.keys(record).join(', ');
            const placeholders = Object.keys(record).map(() => '?').join(', ');
            try {
              db.prepare(`INSERT OR REPLACE INTO ${entity} (${cols}) VALUES (${placeholders})`).run(...Object.values(record));
            } catch (insErr) {
              // Ignore schema column discrepancies gracefully
            }
          }
        });
        insert(items);
      } catch (err: any) {
        console.warn(`SharePoint pullDeltas failed for ${entity}:`, err.message);
      }
    }
  }

  async pushMutations(db: Database.Database): Promise<void> {
    const pending = db.prepare('SELECT * FROM local_mutations WHERE synced = 0 ORDER BY created_at ASC').all() as any[];

    for (const mut of pending) {
      try {
        const payload = JSON.parse(mut.payload_json);
        const listName = SP_ENTITY_LIST_MAP[mut.entity] || mut.entity;

        if (mut.operation === 'CREATE') {
          const spPayload: Record<string, any> = {
            Title: String(payload.id || payload.name || payload.title || payload.username || Math.random().toString()),
            PayloadJson: JSON.stringify(payload)
          };
          if (payload.name) spPayload.Name = String(payload.name);
          if (payload.title) spPayload.TaskTitle = String(payload.title);
          if (payload.status) spPayload.Status = String(payload.status);

          const item = await this.createItem(listName, spPayload);
          if (item?.id) {
            try {
              db.prepare(`UPDATE ${mut.entity} SET sp_item_id = ? WHERE id = ?`).run(String(item.id), payload.id ?? payload.Title);
            } catch (_) {}
          }
        } else if (mut.operation === 'UPDATE' && mut.sp_item_id) {
          const spPayload: Record<string, any> = { PayloadJson: JSON.stringify(payload) };
          if (payload.name) spPayload.Name = String(payload.name);
          if (payload.title) spPayload.TaskTitle = String(payload.title);
          if (payload.status) spPayload.Status = String(payload.status);
          await this.updateItem(listName, mut.sp_item_id, spPayload);
        } else if (mut.operation === 'DELETE' && mut.sp_item_id) {
          await this.deleteItem(listName, mut.sp_item_id);
        }
        db.prepare('UPDATE local_mutations SET synced = 1 WHERE id = ?').run(mut.id);
      } catch (err: any) {
        console.error(`Failed to push mutation ${mut.id} to SharePoint:`, err.message);
      }
    }
  }

  // ── BackendProvider Implementation: Document & File Storage ────

  async uploadDocument(
    fileName: string,
    content: Buffer | Uint8Array | string,
    category?: string
  ): Promise<DocumentUploadResult> {
    const siteId = await this.getSiteId();
    const cleanFileName = fileName.replace(/^\/+/, '');
    const endpoint = `/sites/${siteId}/drive/root:/HorizonPM/Documents/${encodeURIComponent(cleanFileName)}:/content`;

    let bufferData: Buffer;
    if (Buffer.isBuffer(content)) {
      bufferData = content;
    } else if (typeof content === 'string') {
      if (content.startsWith('data:')) {
        const base64Data = content.split(',')[1];
        bufferData = Buffer.from(base64Data, 'base64');
      } else {
        bufferData = Buffer.from(content, 'utf-8');
      }
    } else {
      bufferData = Buffer.from(content);
    }

    const res = await this.request('PUT', endpoint, bufferData, {
      'Content-Type': 'application/octet-stream'
    });

    return {
      driveItemId: res.id,
      webUrl: res.webUrl,
      name: res.name || cleanFileName,
      fileSize: res.size || bufferData.length,
      mimeType: res.file?.mimeType
    };
  }

  async downloadDocument(driveItemId: string): Promise<Buffer> {
    const siteId = await this.getSiteId();
    const token = await this.getToken();
    const res = await axios.get(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${driveItemId}/content`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer'
    });
    return Buffer.from(res.data);
  }

  async deleteDocument(driveItemId: string): Promise<boolean> {
    const siteId = await this.getSiteId();
    await this.request('DELETE', `/sites/${siteId}/drive/items/${driveItemId}`);
    return true;
  }

  // ── Diagnostics & Seeding ───────────────────────────────────────

  async testConnection(overrideSettings?: Record<string, string>): Promise<any> {
    const startTime = Date.now();
    pluginLogger.info('SharePoint', 'Testing Microsoft SharePoint Online connectivity...');
    try {
      if (overrideSettings) {
        this.config = {
          ...this.config,
          settings: { ...this.config.settings, ...overrideSettings }
        };
        this.tokenCache = null;
        this.resolvedSiteId = null;
        await this.initialize();
      }
      const user = await this.getConnectedUser();
      const siteId = await this.getSiteId();
      const pingMs = Date.now() - startTime;
      pluginLogger.success(
        'SharePoint',
        `SharePoint test verified in ${pingMs}ms. Principal: ${user}, Site ID: ${siteId.slice(0, 20)}...`
      );
      return {
        success: true,
        pingMs,
        providerId: this.id,
        providerName: this.name,
        clusterInfo: 'Microsoft SharePoint Online / Graph API v1.0',
        databaseOrPath: this.config.settings?.siteUrl || 'SharePoint Site',
        collectionsOrLists: REQUIRED_SP_LISTS
      };
    } catch (err: any) {
      const pingMs = Date.now() - startTime;
      let msg = err.response?.data?.error?.message || err.message || 'SharePoint test failed';
      if (
        msg.includes('AADSTS50011') ||
        msg.toLowerCase().includes('reply address') ||
        msg.toLowerCase().includes('redirect_uri')
      ) {
        msg = 'Azure AD Error: No reply address registered. In Azure Portal -> App registrations -> Your App -> Authentication -> Add a platform -> Mobile and desktop applications -> Check "http://localhost". Alternatively, use a Client Secret.';
      }
      pluginLogger.error('SharePoint', `Test failed: ${msg}`);
      return {
        success: false,
        pingMs,
        providerId: this.id,
        providerName: this.name,
        clusterInfo: 'Microsoft SharePoint Online',
        databaseOrPath: this.config.settings?.siteUrl || 'N/A',
        collectionsOrLists: [],
        error: msg
      };
    }
  }

  async seedAllTables(db: Database.Database): Promise<{ pushed: Record<string, number>; total: number; providerId: string }> {
    pluginLogger.info('SharePoint', 'Starting full database seed to SharePoint lists...');
    await this.ensureListsExist();
    const results: Record<string, number> = {};
    let grandTotal = 0;

    for (const entity of TRACKED_ENTITIES) {
      const listName = SP_ENTITY_LIST_MAP[entity];
      if (!listName) continue;
      try {
        const rows = db.prepare(`SELECT * FROM ${entity}`).all() as any[];
        if (rows.length === 0) {
          results[listName] = 0;
          continue;
        }

        let count = 0;
        for (const row of rows) {
          const fields: any = { Title: row.name || row.title || row.username || row.id || 'Item' };
          for (const [k, v] of Object.entries(row)) {
            if (v !== null && v !== undefined) fields[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
          }
          await this.createItem(listName, fields);
          count++;
        }
        results[listName] = count;
        grandTotal += count;
        pluginLogger.info('SharePoint', `Seeded ${count} items into SharePoint list '${listName}'`);
      } catch (err: any) {
        pluginLogger.warn('SharePoint', `Warning seeding list '${listName}': ${err.message}`);
      }
    }

    pluginLogger.success('SharePoint', `Seeding complete: ${grandTotal} total items created in SharePoint lists.`);
    return { pushed: results, total: grandTotal, providerId: this.id };
  }
}
