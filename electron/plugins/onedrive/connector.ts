import { PublicClientApplication, Configuration, InteractiveRequest } from '@azure/msal-node';
import axios, { AxiosRequestConfig } from 'axios';
import Database from 'better-sqlite3';
import { PluginConfig } from '../../../src/types';
import { BackendProvider, DocumentUploadResult, TRACKED_ENTITIES } from '../types';
import { pluginLogger } from '../logger';

export class OneDriveConnector implements BackendProvider {
  readonly id = 'onedrive-core';
  readonly name = 'Microsoft OneDrive Core';

  private config: PluginConfig;
  private pca!: PublicClientApplication;
  private tokenCache: string | null = null;

  constructor(config: PluginConfig) {
    this.config = config;
  }

  async initialize() {
    const tenant = this.config.settings?.tenantId?.trim() || 'common';
    const clientId = this.config.settings?.clientId?.trim();

    if (!clientId) {
      throw new Error('OneDrive Client ID is required');
    }

    const msalConfig: Configuration = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenant}`,
      }
    };
    this.pca = new PublicClientApplication(msalConfig);
  }

  async authenticate(): Promise<string> {
    if (!this.pca) {
      await this.initialize();
    }

    try {
      const accounts = await this.pca.getTokenCache().getAllAccounts();
      if (accounts && accounts.length > 0) {
        const silentResult = await this.pca.acquireTokenSilent({
          account: accounts[0],
          scopes: ["Files.ReadWrite.All", "User.Read", "offline_access"]
        });
        if (silentResult?.accessToken) {
          this.tokenCache = silentResult.accessToken;
          return this.tokenCache;
        }
      }
    } catch (_) {}

    const request: InteractiveRequest = {
      scopes: ["Files.ReadWrite.All", "User.Read", "offline_access"],
      openBrowser: async (url: string) => {
        try {
          const { shell } = require('electron');
          await shell.openExternal(url);
        } catch {
          console.log('Open browser for OneDrive authentication:', url);
        }
      }
    };

    const result = await this.pca.acquireTokenInteractive(request);
    this.tokenCache = result.accessToken;
    return this.tokenCache;
  }

  async getToken(): Promise<string> {
    if (this.tokenCache) return this.tokenCache;
    return this.authenticate();
  }

  private async request(method: string, endpoint: string, data?: any, extraConfig?: Partial<AxiosRequestConfig>) {
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
            ...(extraConfig?.headers || {})
          },
          data,
          ...extraConfig
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
    throw new Error('OneDrive API request failed: rate limit exceeded');
  }

  async getConnectedUser(): Promise<string> {
    const data = await this.request('GET', '/me');
    return data.displayName || data.userPrincipalName || data.mail || 'Connected OneDrive User';
  }

  // ── BackendProvider Implementation: Document & File Storage ────

  async uploadDocument(
    fileName: string,
    content: Buffer | Uint8Array | string,
    category?: string
  ): Promise<DocumentUploadResult> {
    const cleanFileName = fileName.replace(/^\/+/, '');
    const folder = (this.config.settings?.folderPath || 'HorizonPM/Documents').replace(/^\/+|\/+$/g, '');
    const endpoint = `/me/drive/root:/${encodeURIComponent(folder)}/${encodeURIComponent(cleanFileName)}:/content`;

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
      headers: { 'Content-Type': 'application/octet-stream' }
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
    const token = await this.getToken();
    const res = await axios.get(`https://graph.microsoft.com/v1.0/me/drive/items/${driveItemId}/content`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer'
    });
    return Buffer.from(res.data);
  }

  async deleteDocument(driveItemId: string): Promise<boolean> {
    await this.request('DELETE', `/me/drive/items/${driveItemId}`);
    return true;
  }

  // ── File Helpers for IPC ────────────────────────────────────────

  async uploadFile(fileName: string, content: any, folderPath?: string): Promise<DocumentUploadResult> {
    return this.uploadDocument(fileName, content, folderPath);
  }

  async downloadFile(driveItemId: string): Promise<Buffer> {
    return this.downloadDocument(driveItemId);
  }

  async listFiles(folderPath?: string): Promise<any[]> {
    const folder = (folderPath || this.config.settings?.folderPath || 'HorizonPM/Documents').replace(/^\/+|\/+$/g, '');
    const endpoint = `/me/drive/root:/${encodeURIComponent(folder)}:/children`;
    try {
      const res = await this.request('GET', endpoint);
      return res.value || [];
    } catch (e: any) {
      if (e.response?.status === 404) return [];
      throw e;
    }
  }

  async deleteFile(driveItemId: string): Promise<boolean> {
    return this.deleteDocument(driveItemId);
  }

  // ── BackendProvider Implementation: Structured Data Sync ───────

  /**
   * Pulls entity datasets from /HorizonPM/Data/{entity}.json in OneDrive,
   * updating local SQLite tables.
   */
  async pullDeltas(db: Database.Database): Promise<void> {
    const dataFolder = 'HorizonPM/Data';

    for (const entity of TRACKED_ENTITIES) {
      try {
        const endpoint = `/me/drive/root:/${encodeURIComponent(dataFolder)}/${entity}.json:/content`;
        const token = await this.getToken();

        let remoteItems: any[] = [];
        try {
          const res = await axios.get(`https://graph.microsoft.com/v1.0${endpoint}`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'json'
          });
          if (Array.isArray(res.data)) {
            remoteItems = res.data;
          }
        } catch (getErr: any) {
          if (getErr.response?.status === 404) {
            // File doesn't exist yet in OneDrive, skip
            continue;
          }
          throw getErr;
        }

        if (remoteItems.length === 0) continue;

        const insert = db.transaction((rows: any[]) => {
          for (const row of rows) {
            const cols = Object.keys(row).join(', ');
            const placeholders = Object.keys(row).map(() => '?').join(', ');
            try {
              db.prepare(`INSERT OR REPLACE INTO ${entity} (${cols}) VALUES (${placeholders})`).run(...Object.values(row));
            } catch (_) {}
          }
        });
        insert(remoteItems);
      } catch (err: any) {
        console.warn(`OneDrive pullDeltas failed for ${entity}:`, err.message);
      }
    }
  }

  /**
   * Pushes local mutations to /HorizonPM/Data/{entity}.json in OneDrive.
   */
  async pushMutations(db: Database.Database): Promise<void> {
    const pending = db.prepare('SELECT * FROM local_mutations WHERE synced = 0 ORDER BY created_at ASC').all() as any[];
    if (pending.length === 0) return;

    const dataFolder = 'HorizonPM/Data';
    const token = await this.getToken();

    // Group mutations by entity
    const byEntity = new Map<string, any[]>();
    for (const mut of pending) {
      if (!byEntity.has(mut.entity)) byEntity.set(mut.entity, []);
      byEntity.get(mut.entity)!.push(mut);
    }

    for (const [entity, mutations] of byEntity.entries()) {
      try {
        // Fetch current remote dataset from OneDrive
        const endpoint = `/me/drive/root:/${encodeURIComponent(dataFolder)}/${entity}.json:/content`;
        let remoteItems: any[] = [];

        try {
          const res = await axios.get(`https://graph.microsoft.com/v1.0${endpoint}`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'json'
          });
          if (Array.isArray(res.data)) remoteItems = res.data;
        } catch (e: any) {
          if (e.response?.status !== 404) console.warn(`Error fetching ${entity}.json from OneDrive:`, e.message);
        }

        const itemMap = new Map<string, any>();
        for (const item of remoteItems) {
          if (item.id) itemMap.set(item.id, item);
        }

        // Apply mutations
        for (const mut of mutations) {
          const payload = JSON.parse(mut.payload_json);
          const itemId = String(payload.id || mut.sp_item_id || Math.random().toString());

          if (mut.operation === 'CREATE' || mut.operation === 'UPDATE') {
            itemMap.set(itemId, { ...payload, id: itemId, updated_at: new Date().toISOString() });
          } else if (mut.operation === 'DELETE') {
            itemMap.delete(itemId);
          }
        }

        const updatedDataset = Array.from(itemMap.values());
        const jsonBuffer = Buffer.from(JSON.stringify(updatedDataset, null, 2), 'utf-8');

        // PUT back to OneDrive
        await this.request('PUT', endpoint, jsonBuffer, {
          headers: { 'Content-Type': 'application/json' }
        });

        // Mark local mutations as synced
        const markSynced = db.transaction((muts: any[]) => {
          for (const m of muts) {
            db.prepare('UPDATE local_mutations SET synced = 1 WHERE id = ?').run(m.id);
          }
        });
        markSynced(mutations);
      } catch (err: any) {
        console.error(`Failed to push mutations to OneDrive for ${entity}:`, err.message);
      }
    }
  }

  // ── Diagnostics & Seeding ───────────────────────────────────────

  async testConnection(overrideSettings?: Record<string, string>): Promise<any> {
    const startTime = Date.now();
    pluginLogger.info('OneDrive', 'Testing Microsoft OneDrive cloud connectivity...');
    try {
      const user = await this.getConnectedUser();
      const driveInfo = await this.request('GET', '/me/drive');
      const pingMs = Date.now() - startTime;
      const folder = (this.config.settings?.folderPath || 'HorizonPM/Documents');
      pluginLogger.success(
        'OneDrive',
        `OneDrive test verified in ${pingMs}ms. User: ${user}, Drive Type: ${driveInfo.driveType || 'personal'}`
      );
      return {
        success: true,
        pingMs,
        providerId: this.id,
        providerName: this.name,
        clusterInfo: `Microsoft OneDrive (${driveInfo.driveType || 'Cloud'})`,
        databaseOrPath: folder,
        collectionsOrLists: TRACKED_ENTITIES.map(e => `${e}.json`)
      };
    } catch (err: any) {
      const pingMs = Date.now() - startTime;
      const msg = err.response?.data?.error?.message || err.message || 'OneDrive test failed';
      pluginLogger.error('OneDrive', `Test failed: ${msg}`);
      return {
        success: false,
        pingMs,
        providerId: this.id,
        providerName: this.name,
        clusterInfo: 'Microsoft OneDrive',
        databaseOrPath: this.config.settings?.folderPath || 'N/A',
        collectionsOrLists: [],
        error: msg
      };
    }
  }

  async seedAllTables(db: Database.Database): Promise<{ pushed: Record<string, number>; total: number; providerId: string }> {
    pluginLogger.info('OneDrive', 'Starting full database seed to OneDrive cloud datasets...');
    const dataFolder = 'HorizonPM/Data';
    const results: Record<string, number> = {};
    let grandTotal = 0;

    for (const entity of TRACKED_ENTITIES) {
      try {
        const rows = db.prepare(`SELECT * FROM ${entity}`).all() as any[];
        const endpoint = `/me/drive/root:/${encodeURIComponent(dataFolder)}/${entity}.json:/content`;
        const jsonBuffer = Buffer.from(JSON.stringify(rows, null, 2), 'utf-8');

        await this.request('PUT', endpoint, jsonBuffer, {
          headers: { 'Content-Type': 'application/json' }
        });

        results[entity] = rows.length;
        grandTotal += rows.length;
        pluginLogger.info('OneDrive', `Seeded ${rows.length} records into OneDrive dataset '${entity}.json'`);
      } catch (err: any) {
        pluginLogger.warn('OneDrive', `Warning seeding OneDrive dataset '${entity}.json': ${err.message}`);
      }
    }

    pluginLogger.success('OneDrive', `Seeding complete: ${grandTotal} total records saved to OneDrive datasets.`);
    return { pushed: results, total: grandTotal, providerId: this.id };
  }
}
