import http from 'http';
import url from 'url';
import axios, { AxiosRequestConfig } from 'axios';
import Database from 'better-sqlite3';
import { PluginConfig } from '../../../src/types';
import { BackendProvider, DocumentUploadResult, TRACKED_ENTITIES } from '../types';
import { pluginLogger } from '../logger';

export function extractGoogleErrorMessage(err: any): string {
  const googleErr = err.response?.data?.error;
  if (googleErr) {
    let msg = googleErr.message || err.message;
    if (googleErr.details && Array.isArray(googleErr.details)) {
      const act = googleErr.details.find((d: any) => d?.metadata?.activationUrl || d?.activationUrl);
      const activationUrl = act?.metadata?.activationUrl || act?.activationUrl;
      if (activationUrl) {
        msg += ` -> Enable API: ${activationUrl}`;
      }
    }
    return msg;
  }
  return err.message || 'Google Drive API request failed';
}

export class GoogleDriveConnector implements BackendProvider {
  readonly id = 'google-drive-core';
  readonly name = 'Google Drive Core';

  private config: PluginConfig;
  private tokenCache: string | null = null;
  private tokenExpiry: number = 0;
  private folderIdCache: Map<string, string> = new Map();

  constructor(config: PluginConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    const clientId = this.config.settings?.clientId?.trim();
    if (!clientId) {
      throw new Error('Google Drive Client ID is required');
    }
  }

  /**
   * Performs OAuth 2.0 authorization code flow via local loopback listener.
   * If a valid refresh token exists, refreshes automatically.
   */
  async authenticate(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenExpiry > now + 60000) {
      return this.tokenCache;
    }

    const clientId = this.config.settings?.clientId?.trim();
    const clientSecret = this.config.settings?.clientSecret?.trim() || '';
    const refreshToken = this.config.settings?.refreshToken?.trim();

    if (!clientId) {
      throw new Error('Google Drive Client ID is missing. Please configure your Client ID.');
    }

    // Attempt refresh token exchange if available
    if (refreshToken) {
      try {
        const refreshParams = new URLSearchParams({
          client_id: clientId,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        });
        if (clientSecret) {
          refreshParams.append('client_secret', clientSecret);
        }

        const res = await axios.post('https://oauth2.googleapis.com/token', refreshParams.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (res.data?.access_token) {
          this.tokenCache = res.data.access_token as string;
          this.tokenExpiry = Date.now() + (res.data.expires_in || 3600) * 1000;
          return this.tokenCache!;
        }
      } catch (refreshErr: any) {
        pluginLogger.warn('GoogleDrive', `Token refresh failed: ${refreshErr.message}. Initiating interactive sign-in.`);
      }
    }

    // Interactive OAuth 2.0 Loopback flow
    return new Promise<string>((resolve, reject) => {
      const port = 8585;
      const redirectUri = `http://127.0.0.1:${port}`;

      let server: http.Server | null = null;
      const timeout = setTimeout(() => {
        try { server?.close(); } catch (_) {}
        reject(new Error('Google Drive authentication timed out after 3 minutes.'));
      }, 180000);

      server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url || '', true);
          const code = parsedUrl.query.code as string;
          const error = parsedUrl.query.error as string;

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<html><body style="font-family:sans-serif;background:#070B19;color:#fff;text-align:center;padding:50px;">
              <h2 style="color:#F43F5E;">Authentication Failed</h2><p>${error}</p></body></html>`);
            clearTimeout(timeout);
            server.close();
            reject(new Error(`Google sign-in error: ${error}`));
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html>
              <html>
              <head><title>Horizon - Google Authentication Complete</title></head>
              <body style="font-family:system-ui,-apple-system,sans-serif;background:#070B19;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                <div style="background:#0D152E;border:1px solid #1E2D52;border-radius:16px;padding:40px;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);max-width:440px;">
                  <div style="width:48px;height:48px;background:rgba(16,185,129,0.15);color:#10B981;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;">&#x2714;</div>
                  <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;">Google Drive Connected</h2>
                  <p style="color:#9CA3AF;font-size:13px;line-height:1.6;margin:0 0 20px;">Horizon has securely verified your Google account. You can close this tab and return to the application.</p>
                </div>
              </body>
              </html>`);

            clearTimeout(timeout);
            server.close();

            // Exchange auth code for tokens
            const tokenParams = new URLSearchParams({
              code,
              client_id: clientId,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code'
            });
            if (clientSecret) {
              tokenParams.append('client_secret', clientSecret);
            }

            const tokenRes = await axios.post('https://oauth2.googleapis.com/token', tokenParams.toString(), {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const data = tokenRes.data;
            if (!data.access_token) {
              throw new Error('Invalid response from Google OAuth server: access token missing');
            }

            this.tokenCache = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;

            if (data.refresh_token) {
              this.config.settings = {
                ...this.config.settings,
                refreshToken: data.refresh_token
              };
            }

            resolve(this.tokenCache!);
          }
        } catch (e: any) {
          clearTimeout(timeout);
          try { server.close(); } catch (_) {}
          reject(e);
        }
      });

      server.listen(port, '127.0.0.1', async () => {
        const scopes = [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
          'openid'
        ].join(' ');

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;

        try {
          const { shell } = require('electron');
          await shell.openExternal(authUrl);
        } catch {
          console.log('Open browser for Google Drive authentication:', authUrl);
        }
      });

      server.on('error', (err: any) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to bind local loopback port ${port}: ${err.message}`));
      });
    });
  }

  async getToken(): Promise<string> {
    if (this.tokenCache && this.tokenExpiry > Date.now() + 60000) {
      return this.tokenCache;
    }
    return this.authenticate();
  }

  getRefreshToken(): string | undefined {
    return this.config.settings?.refreshToken;
  }

  private async request(method: string, endpoint: string, data?: any, extraConfig?: Partial<AxiosRequestConfig>) {
    const token = await this.getToken();
    let retries = 3;
    let delay = 1500;

    while (retries > 0) {
      try {
        const url = endpoint.startsWith('http') ? endpoint : `https://www.googleapis.com${endpoint}`;
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
        if (err.response && (err.response.status === 429 || err.response.status === 503)) {
          retries--;
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        } else if (err.response && err.response.status === 401) {
          this.tokenCache = null;
          this.tokenExpiry = 0;
          if (retries > 0) {
            await this.authenticate();
            continue;
          }
          throw err;
        } else {
          const msg = extractGoogleErrorMessage(err);
          const enhanced = new Error(msg);
          (enhanced as any).response = err.response;
          (enhanced as any).status = err.response?.status;
          throw enhanced;
        }
      }
    }
    throw new Error('Google Drive API request failed: retry limit exceeded');
  }

  async getConnectedUser(): Promise<string> {
    try {
      const data = await this.request('GET', '/oauth2/v2/userinfo');
      const name = data.name || data.email || 'Connected Google User';
      const email = data.email ? ` (${data.email})` : '';
      return `${name}${email}`;
    } catch {
      return 'Connected Google Drive User';
    }
  }

  // ── Drive Folder Hierarchy Helpers ──────────────────────────────

  /**
   * Resolves or creates a folder path in Google Drive (e.g. "HorizonPM/Documents").
   */
  async getOrCreateFolder(pathStr: string): Promise<string> {
    const cleanPath = pathStr.replace(/^\/+|\/+$/g, '');
    if (this.folderIdCache.has(cleanPath)) {
      return this.folderIdCache.get(cleanPath)!;
    }

    const parts = cleanPath.split('/').filter(Boolean);
    let parentId = 'root';

    for (const part of parts) {
      const subPathKey = `${parentId}/${part}`;
      if (this.folderIdCache.has(subPathKey)) {
        parentId = this.folderIdCache.get(subPathKey)!;
        continue;
      }

      const q = `'${parentId}' in parents and name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const searchRes = await this.request('GET', `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);

      if (searchRes.files && searchRes.files.length > 0) {
        parentId = searchRes.files[0].id;
      } else {
        const createRes = await this.request('POST', '/drive/v3/files', {
          name: part,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        });
        parentId = createRes.id;
      }
      this.folderIdCache.set(subPathKey, parentId);
    }

    this.folderIdCache.set(cleanPath, parentId);
    return parentId;
  }

  // ── BackendProvider Implementation: Document & File Storage ────

  async uploadDocument(
    fileName: string,
    content: Buffer | Uint8Array | string,
    category?: string
  ): Promise<DocumentUploadResult> {
    const cleanFileName = fileName.replace(/^\/+/, '');
    const baseFolder = (this.config.settings?.folderPath || 'HorizonPM').replace(/^\/+|\/+$/g, '');
    const targetFolder = `${baseFolder}/Documents`;
    const folderId = await this.getOrCreateFolder(targetFolder);

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

    // Check if file already exists in target folder
    const searchQ = `'${folderId}' in parents and name = '${cleanFileName}' and trashed = false`;
    const searchRes = await this.request('GET', `/drive/v3/files?q=${encodeURIComponent(searchQ)}&fields=files(id,webViewLink)`);

    const token = await this.getToken();
    let fileId: string;
    let webViewLink: string;

    if (searchRes.files && searchRes.files.length > 0) {
      // Update existing file content
      fileId = searchRes.files[0].id;
      webViewLink = searchRes.files[0].webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
      await axios.patch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, bufferData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream'
        }
      });
    } else {
      // Create new file with multipart/related upload
      const boundary = '-------314159265358979323846';
      const metadata = JSON.stringify({
        name: cleanFileName,
        parents: [folderId],
        description: `Horizon specification doc [${category || 'General'}]`
      });

      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody = Buffer.concat([
        Buffer.from(
          `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}` +
          `${delimiter}Content-Type: application/octet-stream\r\n\r\n`
        ),
        bufferData,
        Buffer.from(closeDelimiter)
      ]);

      const createRes = await axios.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,mimeType,webViewLink',
        multipartBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          }
        }
      );

      fileId = createRes.data.id;
      webViewLink = createRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
    }

    return {
      driveItemId: fileId,
      webUrl: webViewLink,
      name: cleanFileName,
      fileSize: bufferData.length,
      mimeType: 'application/octet-stream'
    };
  }

  async downloadDocument(driveItemId: string): Promise<Buffer> {
    const token = await this.getToken();
    const res = await axios.get(`https://www.googleapis.com/drive/v3/files/${driveItemId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer'
    });
    return Buffer.from(res.data);
  }

  async deleteDocument(driveItemId: string): Promise<boolean> {
    try {
      await this.request('DELETE', `/drive/v3/files/${driveItemId}`);
      return true;
    } catch {
      return false;
    }
  }

  // ── File Helpers for IPC ────────────────────────────────────────

  async uploadFile(fileName: string, content: any, folderPath?: string): Promise<DocumentUploadResult> {
    return this.uploadDocument(fileName, content, folderPath);
  }

  async downloadFile(driveItemId: string): Promise<Buffer> {
    return this.downloadDocument(driveItemId);
  }

  async listFiles(folderPath?: string): Promise<any[]> {
    const baseFolder = folderPath || `${this.config.settings?.folderPath || 'HorizonPM'}/Documents`;
    const folderId = await this.getOrCreateFolder(baseFolder);
    const q = `'${folderId}' in parents and trashed = false`;
    const res = await this.request('GET', `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,webViewLink,modifiedTime)`);
    return res.files || [];
  }

  async deleteFile(driveItemId: string): Promise<boolean> {
    return this.deleteDocument(driveItemId);
  }

  // ── BackendProvider Implementation: Structured Data Sync ───────

  /**
   * Pulls entity datasets from /HorizonPM/Data/{entity}.json in Google Drive,
   * updating local SQLite tables.
   */
  async pullDeltas(db: Database.Database): Promise<void> {
    const baseFolder = `${this.config.settings?.folderPath || 'HorizonPM'}/Data`;
    const folderId = await this.getOrCreateFolder(baseFolder);

    for (const entity of TRACKED_ENTITIES) {
      try {
        const q = `'${folderId}' in parents and name = '${entity}.json' and trashed = false`;
        const searchRes = await this.request('GET', `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`);

        if (!searchRes.files || searchRes.files.length === 0) continue;

        const fileId = searchRes.files[0].id;
        const jsonBuffer = await this.downloadDocument(fileId);
        const remoteItems = JSON.parse(jsonBuffer.toString('utf-8'));

        if (!Array.isArray(remoteItems) || remoteItems.length === 0) continue;

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
        console.warn(`Google Drive pullDeltas failed for ${entity}:`, err.message);
      }
    }
  }

  /**
   * Pushes local mutations to /HorizonPM/Data/{entity}.json in Google Drive.
   */
  async pushMutations(db: Database.Database): Promise<void> {
    const pending = db.prepare('SELECT * FROM local_mutations WHERE synced = 0 ORDER BY created_at ASC').all() as any[];
    if (pending.length === 0) return;

    const baseFolder = `${this.config.settings?.folderPath || 'HorizonPM'}/Data`;
    const folderId = await this.getOrCreateFolder(baseFolder);

    // Group mutations by entity
    const grouped = new Map<string, any[]>();
    for (const m of pending) {
      if (!grouped.has(m.entity)) grouped.set(m.entity, []);
      grouped.get(m.entity)!.push(m);
    }

    for (const [entity, mutations] of grouped) {
      try {
        const q = `'${folderId}' in parents and name = '${entity}.json' and trashed = false`;
        const searchRes = await this.request('GET', `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`);

        let existingDataset: any[] = [];
        let fileId: string | null = null;

        if (searchRes.files && searchRes.files.length > 0) {
          fileId = searchRes.files[0].id;
          try {
            const buf = await this.downloadDocument(fileId!);
            existingDataset = JSON.parse(buf.toString('utf-8'));
          } catch (_) {}
        }

        const itemMap = new Map<string, any>();
        for (const item of existingDataset) {
          itemMap.set(item.id, item);
        }

        for (const m of mutations) {
          const payload = typeof m.payload_json === 'string' ? JSON.parse(m.payload_json) : m.payload_json;
          if (m.operation === 'delete') {
            itemMap.delete(m.sp_item_id || payload?.id);
          } else {
            const id = payload?.id || m.sp_item_id;
            if (id) itemMap.set(id, { ...itemMap.get(id), ...payload, id });
          }
        }

        const updatedDataset = Array.from(itemMap.values());
        const jsonBuffer = Buffer.from(JSON.stringify(updatedDataset, null, 2), 'utf-8');
        const token = await this.getToken();

        if (fileId) {
          try {
            await axios.patch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, jsonBuffer, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
          } catch (patchErr: any) {
            throw new Error(extractGoogleErrorMessage(patchErr));
          }
        } else {
          // Upload new file
          await this.uploadJsonFile(folderId, `${entity}.json`, jsonBuffer);
        }

        // Mark local mutations as synced
        const markSynced = db.transaction((muts: any[]) => {
          for (const m of muts) {
            db.prepare('UPDATE local_mutations SET synced = 1 WHERE id = ?').run(m.id);
          }
        });
        markSynced(mutations);
      } catch (err: any) {
        const msg = extractGoogleErrorMessage(err);
        pluginLogger.error('GoogleDrive', `Failed to push mutations to Google Drive for ${entity}: ${msg}`);
        throw new Error(msg);
      }
    }
  }

  private async uploadJsonFile(folderId: string, fileName: string, content: Buffer): Promise<void> {
    const token = await this.getToken();
    const boundary = '-------314159265358979323846';
    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId]
    });

    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBody = Buffer.concat([
      Buffer.from(
        `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}` +
        `${delimiter}Content-Type: application/json\r\n\r\n`
      ),
      content,
      Buffer.from(closeDelimiter)
    ]);

    try {
      await axios.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        multipartBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          }
        }
      );
    } catch (err: any) {
      throw new Error(extractGoogleErrorMessage(err));
    }
  }

  // ── Diagnostics & Seeding ───────────────────────────────────────

  async testConnection(overrideSettings?: Record<string, string>): Promise<any> {
    const startTime = Date.now();
    pluginLogger.info('GoogleDrive', 'Testing Google Drive cloud connectivity...');
    try {
      if (overrideSettings?.clientId) {
        this.config.settings = { ...this.config.settings, ...overrideSettings };
      }

      const user = await this.getConnectedUser();
      const about = await this.request('GET', '/drive/v3/about?fields=user,storageQuota');
      const pingMs = Date.now() - startTime;
      const folder = this.config.settings?.folderPath || '/HorizonPM';

      pluginLogger.success(
        'GoogleDrive',
        `Google Drive test verified in ${pingMs}ms. User: ${user}`
      );

      return {
        success: true,
        pingMs,
        providerId: this.id,
        providerName: this.name,
        clusterInfo: `Google Drive (${about.user?.displayName || 'Google Cloud'})`,
        databaseOrPath: folder,
        collectionsOrLists: TRACKED_ENTITIES.map(e => `${e}.json`)
      };
    } catch (err: any) {
      const pingMs = Date.now() - startTime;
      const msg = extractGoogleErrorMessage(err);
      pluginLogger.error('GoogleDrive', `Test failed: ${msg}`);
      return {
        success: false,
        pingMs,
        providerId: this.id,
        providerName: this.name,
        clusterInfo: 'Google Drive Core',
        databaseOrPath: this.config.settings?.folderPath || 'N/A',
        collectionsOrLists: [],
        error: msg
      };
    }
  }

  async seedAllTables(db: Database.Database): Promise<{ pushed: Record<string, number>; total: number; providerId: string }> {
    pluginLogger.info('GoogleDrive', 'Starting full database seed to Google Drive cloud datasets...');
    const baseFolder = `${this.config.settings?.folderPath || 'HorizonPM'}/Data`;
    const folderId = await this.getOrCreateFolder(baseFolder);
    const results: Record<string, number> = {};
    let grandTotal = 0;

    for (const entity of TRACKED_ENTITIES) {
      try {
        const rows = db.prepare(`SELECT * FROM ${entity}`).all() as any[];
        const jsonBuffer = Buffer.from(JSON.stringify(rows, null, 2), 'utf-8');

        // Check if file exists
        const q = `'${folderId}' in parents and name = '${entity}.json' and trashed = false`;
        const searchRes = await this.request('GET', `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`);

        if (searchRes.files && searchRes.files.length > 0) {
          const fileId = searchRes.files[0].id;
          const token = await this.getToken();
          await axios.patch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, jsonBuffer, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
        } else {
          await this.uploadJsonFile(folderId, `${entity}.json`, jsonBuffer);
        }

        results[entity] = rows.length;
        grandTotal += rows.length;
        pluginLogger.info('GoogleDrive', `Seeded ${rows.length} records into Google Drive dataset '${entity}.json'`);
      } catch (err: any) {
        pluginLogger.warn('GoogleDrive', `Warning seeding Google Drive dataset '${entity}.json': ${err.message}`);
      }
    }

    pluginLogger.success('GoogleDrive', `Seeding complete: ${grandTotal} total records saved to Google Drive.`);
    return { pushed: results, total: grandTotal, providerId: this.id };
  }
}
