import { IpcMain, app } from 'electron';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { PluginConfig, IPC } from '../../src/types';
import { BackendProvider } from './types';
import { SharePointConnector, SP_ENTITY_LIST_MAP } from './sharepoint/connector';
import { OneDriveConnector } from './onedrive/connector';
import { GoogleDriveConnector } from './google-drive/connector';
import { MongoDBConnector } from './mongodb/connector';
import { AzureKeyVaultConnector } from './azure-keyvault/connector';
import { pluginLogger } from './logger';

export class PluginHost {
  private db: Database.Database;
  private spConnectors = new Map<string, SharePointConnector>();
  private odConnectors = new Map<string, OneDriveConnector>();
  private gdriveConnectors = new Map<string, GoogleDriveConnector>();
  private mongoConnectors = new Map<string, MongoDBConnector>();
  private akvConnectors = new Map<string, AzureKeyVaultConnector>();

  constructor(db: Database.Database) {
    this.db = db;
    this.loadPortableConfig();
  }

  private getPortableConfigPaths(): string[] {
    const paths: string[] = [];
    try {
      if (app && typeof app.getPath === 'function') {
        paths.push(path.join(app.getPath('userData'), 'horizon-config.json'));
      }
    } catch (_) {}
    try {
      paths.push(path.join(process.cwd(), 'horizon-config.json'));
    } catch (_) {}
    try {
      if (process.execPath) {
        paths.push(path.join(path.dirname(process.execPath), 'horizon-config.json'));
      }
    } catch (_) {}
    return Array.from(new Set(paths));
  }

  loadPortableConfig(): void {
    for (const filePath of this.getPortableConfigPaths()) {
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          if (data && data.app_settings) {
            for (const [k, v] of Object.entries(data.app_settings)) {
              if (v !== undefined && v !== null) {
                this.db.prepare(`
                  INSERT INTO app_settings (key, value, updated_at)
                  VALUES (?, ?, CURRENT_TIMESTAMP)
                  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
                `).run(k, String(v));
              }
            }
          }
          if (data && data.plugins) {
            for (const [pluginId, settings] of Object.entries(data.plugins)) {
              if (settings && Object.keys(settings as any).length > 0) {
                const existing = this.db.prepare('SELECT settings_json FROM plugin_configs WHERE plugin_id = ?').get(pluginId) as any;
                if (!existing || !existing.settings_json || existing.settings_json === '{}') {
                  this.db.prepare(`
                    INSERT INTO plugin_configs (plugin_id, settings_json, status, error)
                    VALUES (?, ?, 'disconnected', NULL)
                    ON CONFLICT(plugin_id) DO UPDATE SET settings_json = excluded.settings_json
                  `).run(pluginId, JSON.stringify(settings));
                  pluginLogger.info('PluginHost', `Auto-loaded settings for ${pluginId} from ${filePath}`);
                }
              }
            }
          }
          if (data.active_backend) {
            const currentBackend = this.getActiveBackendId();
            if (!currentBackend || currentBackend === 'sharepoint-core' || currentBackend === 'none') {
              this.setActiveBackendId(data.active_backend);
            }
          }
          break;
        }
      } catch (err: any) {
        pluginLogger.warn('PluginHost', `Failed to read config from ${filePath}: ${err.message}`);
      }
    }
  }

  savePortableConfig(): void {
    try {
      const rows = this.db.prepare('SELECT plugin_id, settings_json FROM plugin_configs').all() as any[];
      const plugins: Record<string, any> = {};
      for (const r of rows) {
        if (r.settings_json) {
          try {
            plugins[r.plugin_id] = JSON.parse(r.settings_json);
          } catch (_) {}
        }
      }
      const settingRows = this.db.prepare('SELECT key, value FROM app_settings').all() as any[];
      const appSettings: Record<string, string> = {};
      for (const s of settingRows) {
        appSettings[s.key] = s.value;
      }
      const data = {
        active_backend: this.getActiveBackendId(),
        plugins,
        app_settings: appSettings,
        updated_at: new Date().toISOString()
      };
      const jsonStr = JSON.stringify(data, null, 2);

      for (const filePath of this.getPortableConfigPaths()) {
        try {
          fs.writeFileSync(filePath, jsonStr, 'utf-8');
        } catch (_) {}
      }
    } catch (_) {}
  }

  getActiveBackendId(): string {
    try {
      const row = this.db.prepare("SELECT value FROM app_settings WHERE key = 'active_backend_provider'").get() as any;
      if (row?.value) {
        if (row.value === 'local' || row.value === 'none') return 'local';
        const statusRow = this.db.prepare('SELECT status FROM plugin_configs WHERE plugin_id = ?').get(row.value) as any;
        if (statusRow?.status === 'connected') {
          return row.value;
        }
        return 'local';
      }
    } catch (_) {}
    return 'local';
  }

  setActiveBackendId(id: string): void {
    try {
      this.db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('active_backend_provider', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).run(id);
      this.savePortableConfig();
    } catch (_) {}
  }

  loadPlugin(pluginId: string): PluginConfig | null {
    const row = this.db.prepare('SELECT * FROM plugin_configs WHERE plugin_id = ?').get(pluginId) as any;
    if (row && row.settings_json) {
      const config: PluginConfig = {
        pluginId,
        settings: JSON.parse(row.settings_json),
        status: row.status,
        connectedAs: row.connected_as,
        connectedAt: row.connected_at,
        error: row.error
      };

      if (pluginId === 'sharepoint-core') {
        const connector = new SharePointConnector(config);
        this.spConnectors.set(pluginId, connector);
        return config;
      } else if (pluginId === 'onedrive-core') {
        const connector = new OneDriveConnector(config);
        this.odConnectors.set(pluginId, connector);
        return config;
      } else if (pluginId === 'google-drive-core') {
        const connector = new GoogleDriveConnector(config);
        this.gdriveConnectors.set(pluginId, connector);
        return config;
      } else if (pluginId === 'mongodb-core') {
        const connector = new MongoDBConnector(config);
        this.mongoConnectors.set(pluginId, connector);
        return config;
      } else if (pluginId === 'azure-keyvault') {
        const connector = new AzureKeyVaultConnector(config);
        this.akvConnectors.set(pluginId, connector);
        return config;
      }
    }
    return null;
  }

  saveConfig(pluginId: string, settings: Record<string, string>) {
    this.db.prepare(`
      INSERT INTO plugin_configs (plugin_id, settings_json, status, error)
      VALUES (?, ?, ?, NULL)
      ON CONFLICT(plugin_id) DO UPDATE SET settings_json = excluded.settings_json, error = NULL
    `).run(pluginId, JSON.stringify(settings), 'configuring');

    this.loadPlugin(pluginId);
    this.savePortableConfig();
  }

  getSharePointConnector(): SharePointConnector {
    let connector = this.spConnectors.get('sharepoint-core');
    if (!connector) {
      this.loadPlugin('sharepoint-core');
      connector = this.spConnectors.get('sharepoint-core');
    }
    if (!connector) throw new Error('SharePoint Connector is not configured or initialized.');
    return connector;
  }

  getOneDriveConnector(): OneDriveConnector {
    let connector = this.odConnectors.get('onedrive-core');
    if (!connector) {
      this.loadPlugin('onedrive-core');
      connector = this.odConnectors.get('onedrive-core');
    }
    if (!connector) throw new Error('OneDrive Connector is not configured or initialized.');
    return connector;
  }

  getGoogleDriveConnector(): GoogleDriveConnector {
    let connector = this.gdriveConnectors.get('google-drive-core');
    if (!connector) {
      this.loadPlugin('google-drive-core');
      connector = this.gdriveConnectors.get('google-drive-core');
    }
    if (!connector) throw new Error('Google Drive Connector is not configured or initialized.');
    return connector;
  }

  getMongoConnector(): MongoDBConnector {
    let connector = this.mongoConnectors.get('mongodb-core');
    if (!connector) {
      this.loadPlugin('mongodb-core');
      connector = this.mongoConnectors.get('mongodb-core');
    }
    if (!connector) throw new Error('MongoDB Connector is not configured or initialized.');
    return connector;
  }

  getAzureKeyVaultConnector(): AzureKeyVaultConnector {
    let connector = this.akvConnectors.get('azure-keyvault');
    if (!connector) {
      this.loadPlugin('azure-keyvault');
      connector = this.akvConnectors.get('azure-keyvault');
    }
    if (!connector) throw new Error('Azure Key Vault Connector is not configured or initialized.');
    return connector;
  }

  getConnector(pluginId: string): any {
    if (pluginId === 'sharepoint-core') return this.getSharePointConnector();
    if (pluginId === 'onedrive-core') return this.getOneDriveConnector();
    if (pluginId === 'google-drive-core') return this.getGoogleDriveConnector();
    if (pluginId === 'mongodb-core') return this.getMongoConnector();
    if (pluginId === 'azure-keyvault') return this.getAzureKeyVaultConnector();
    throw new Error(`Unknown plugin connector: ${pluginId}`);
  }

  getActiveProvider(): BackendProvider | null {
    const activeId = this.getActiveBackendId();
    if (!activeId || activeId === 'none' || activeId === 'local') return null;

    const statusRow = this.db.prepare('SELECT status FROM plugin_configs WHERE plugin_id = ?').get(activeId) as any;
    if (!statusRow || statusRow.status !== 'connected') {
      return null;
    }

    try {
      if (activeId === 'sharepoint-core') return this.getSharePointConnector();
      if (activeId === 'onedrive-core') return this.getOneDriveConnector();
      if (activeId === 'google-drive-core') return this.getGoogleDriveConnector();
      if (activeId === 'mongodb-core') return this.getMongoConnector();
    } catch (_) {
      return null;
    }
    return null;
  }

  getStatus(pluginId: string): PluginConfig | null {
    const row = this.db.prepare('SELECT * FROM plugin_configs WHERE plugin_id = ?').get(pluginId) as any;
    if (!row) return null;
    return {
      pluginId: row.plugin_id,
      settings: row.settings_json ? JSON.parse(row.settings_json) : {},
      status: row.status,
      connectedAs: row.connected_as,
      connectedAt: row.connected_at,
      error: row.error
    };
  }

  listPlugins(): PluginConfig[] {
    const rows = this.db.prepare('SELECT * FROM plugin_configs').all() as any[];
    const map = new Map<string, PluginConfig>();
    for (const row of rows) {
      map.set(row.plugin_id, {
        pluginId: row.plugin_id,
        settings: row.settings_json ? JSON.parse(row.settings_json) : {},
        status: row.status,
        connectedAs: row.connected_as,
        connectedAt: row.connected_at,
        error: row.error
      });
    }

    const defaultPlugins = ['sharepoint-core', 'onedrive-core', 'google-drive-core', 'mongodb-core', 'azure-keyvault'];
    for (const id of defaultPlugins) {
      if (!map.has(id)) {
        map.set(id, {
          pluginId: id,
          settings: {},
          status: 'disconnected'
        });
      }
    }

    return Array.from(map.values());
  }

  async testBackend(pluginId?: string, overrideSettings?: Record<string, string>): Promise<any> {
    const targetId = pluginId || this.getActiveBackendId();
    if (!targetId || targetId === 'none') {
      return {
        success: false,
        pingMs: 0,
        providerId: 'none',
        providerName: 'Offline Mode',
        clusterInfo: 'No Cloud Backend Active',
        databaseOrPath: 'Local SQLite Database',
        collectionsOrLists: [],
        error: 'No active backend provider selected. Running in offline local mode.'
      };
    }

    try {
      this.loadPlugin(targetId);
      const connector = this.getConnector(targetId);
      if (typeof connector.testConnection === 'function') {
        return await connector.testConnection(overrideSettings);
      }
      return {
        success: true,
        pingMs: 1,
        providerId: targetId,
        providerName: targetId,
        clusterInfo: 'Connected',
        databaseOrPath: 'Ready',
        collectionsOrLists: []
      };
    } catch (err: any) {
      return {
        success: false,
        pingMs: 0,
        providerId: targetId,
        providerName: targetId,
        clusterInfo: 'Error',
        databaseOrPath: 'N/A',
        collectionsOrLists: [],
        error: err.message || 'Connection test failed'
      };
    }
  }

  async seedBackend(pluginId?: string): Promise<any> {
    const targetId = pluginId || this.getActiveBackendId();
    if (!targetId || targetId === 'none') {
      throw new Error('No cloud backend provider is active. Please connect and select an active provider first.');
    }

    this.loadPlugin(targetId);
    const connector = this.getConnector(targetId);
    if (typeof connector.seedAllTables === 'function') {
      return await connector.seedAllTables(this.db);
    }
    throw new Error(`Provider ${targetId} does not support full database seeding.`);
  }

  async findUserInCloud(username: string): Promise<any | null> {
    try {
      this.loadPlugin('mongodb-core');
      const connector = this.mongoConnectors.get('mongodb-core');
      if (connector) {
        return await connector.findUser(username);
      }
    } catch (err: any) {
      pluginLogger.warn('PluginHost', `Cloud user lookup error for ${username}: ${err.message}`);
    }
    return null;
  }

  async pushUserToCloud(user: any, operation: 'upsert' | 'delete'): Promise<void> {
    try {
      this.loadPlugin('mongodb-core');
      const connector = this.mongoConnectors.get('mongodb-core');
      if (connector) {
        if (operation === 'delete') {
          await connector.deleteUser(user.id || user);
        } else {
          await connector.upsertUser(user);
        }
      }
    } catch (err: any) {
      pluginLogger.warn('PluginHost', `Could not push user to cloud: ${err.message}`);
    }
  }
}

export function registerPluginHandlers(ipcMain: IpcMain, db: Database.Database, pluginHost: PluginHost) {
  ipcMain.handle(IPC.PLUGIN_LIST, () => pluginHost.listPlugins());

  ipcMain.handle(IPC.PLUGIN_GET_ACTIVE_BACKEND, () => pluginHost.getActiveBackendId());

  ipcMain.handle(IPC.PLUGIN_SET_ACTIVE_BACKEND, (_event, providerId: string) => {
    pluginHost.setActiveBackendId(providerId);
    return true;
  });

  ipcMain.handle(IPC.PLUGIN_SAVE_CONFIG, (_event, pluginId: string, settings: Record<string, string>) => {
    pluginHost.saveConfig(pluginId, settings);
    return true;
  });

  ipcMain.handle(IPC.PLUGIN_CONNECT, async (_event, pluginId: string) => {
    try {
      pluginHost.loadPlugin(pluginId);

      if (pluginId === 'sharepoint-core') {
        const connector = pluginHost.getSharePointConnector();
        await connector.initialize();
        await connector.authenticate();
        const user = await connector.getConnectedUser();

        try {
          await connector.ensureListsExist();
        } catch (provErr: any) {
          console.warn('SharePoint auto-provision warning:', provErr.message);
        }

        db.prepare(`
          UPDATE plugin_configs 
          SET status = 'connected', connected_as = ?, connected_at = CURRENT_TIMESTAMP, error = NULL 
          WHERE plugin_id = ?
        `).run(user, pluginId);

        if (!pluginHost.getActiveBackendId() || pluginHost.getActiveBackendId() === 'none') {
          pluginHost.setActiveBackendId(pluginId);
        }

        return { success: true, connectedAs: user };
      } else if (pluginId === 'onedrive-core') {
        const connector = pluginHost.getOneDriveConnector();
        await connector.initialize();
        await connector.authenticate();
        const user = await connector.getConnectedUser();

        db.prepare(`
          UPDATE plugin_configs 
          SET status = 'connected', connected_as = ?, connected_at = CURRENT_TIMESTAMP, error = NULL 
          WHERE plugin_id = ?
        `).run(user, pluginId);

        if (!pluginHost.getActiveBackendId() || pluginHost.getActiveBackendId() === 'none') {
          pluginHost.setActiveBackendId(pluginId);
        }

        return { success: true, connectedAs: user };
      } else if (pluginId === 'google-drive-core') {
        const connector = pluginHost.getGoogleDriveConnector();
        await connector.initialize();
        await connector.authenticate();
        const user = await connector.getConnectedUser();

        const refreshToken = connector.getRefreshToken();
        if (refreshToken) {
          const cur = db.prepare('SELECT settings_json FROM plugin_configs WHERE plugin_id = ?').get(pluginId) as any;
          const curSettings = cur?.settings_json ? JSON.parse(cur.settings_json) : {};
          curSettings.refreshToken = refreshToken;
          db.prepare('UPDATE plugin_configs SET settings_json = ? WHERE plugin_id = ?').run(JSON.stringify(curSettings), pluginId);
        }

        db.prepare(`
          UPDATE plugin_configs 
          SET status = 'connected', connected_as = ?, connected_at = CURRENT_TIMESTAMP, error = NULL 
          WHERE plugin_id = ?
        `).run(user, pluginId);

        if (!pluginHost.getActiveBackendId() || pluginHost.getActiveBackendId() === 'none') {
          pluginHost.setActiveBackendId(pluginId);
        }

        return { success: true, connectedAs: user };
      } else if (pluginId === 'mongodb-core') {
        const connector = pluginHost.getMongoConnector();
        await connector.initialize();
        await connector.authenticate();
        const user = await connector.getConnectedUser();

        db.prepare(`
          UPDATE plugin_configs 
          SET status = 'connected', connected_as = ?, connected_at = CURRENT_TIMESTAMP, error = NULL 
          WHERE plugin_id = ?
        `).run(user, pluginId);

        if (!pluginHost.getActiveBackendId() || pluginHost.getActiveBackendId() === 'none') {
          pluginHost.setActiveBackendId(pluginId);
        }

        return { success: true, connectedAs: user };
      } else if (pluginId === 'azure-keyvault') {
        const connector = pluginHost.getAzureKeyVaultConnector();
        await connector.initialize();
        await connector.authenticate();
        const connectedUser = await connector.getConnectedUser();

        db.prepare(`
          UPDATE plugin_configs 
          SET status = 'connected', connected_as = ?, connected_at = CURRENT_TIMESTAMP, error = NULL 
          WHERE plugin_id = ?
        `).run(connectedUser, pluginId);

        return { success: true, connectedAs: connectedUser };
      }

      throw new Error(`Unsupported plugin for connection: ${pluginId}`);
    } catch (err: any) {
      const errMsg = err.message || 'Authentication failed';
      db.prepare(`
        UPDATE plugin_configs 
        SET status = 'error', error = ? 
        WHERE plugin_id = ?
      `).run(errMsg, pluginId);
      throw new Error(errMsg);
    }
  });

  ipcMain.handle(IPC.PLUGIN_DISCONNECT, async (_event, pluginId: string) => {
    if (pluginId === 'mongodb-core') {
      try {
        const connector = pluginHost.getMongoConnector();
        await connector.disconnect();
      } catch (_) {}
    }

    db.prepare(`
      UPDATE plugin_configs 
      SET status = 'disconnected', connected_as = NULL, connected_at = NULL, error = NULL 
      WHERE plugin_id = ?
    `).run(pluginId);

    if (pluginHost.getActiveBackendId() === pluginId) {
      pluginHost.setActiveBackendId('none');
    }
    return true;
  });

  ipcMain.handle(IPC.PLUGIN_GET_STATUS, (_event, pluginId: string) => {
    return pluginHost.getStatus(pluginId);
  });

  ipcMain.handle(IPC.PLUGIN_TEST_CONNECTION, async (_event, pluginId?: string, overrideSettings?: Record<string, string>) => {
    return await pluginHost.testBackend(pluginId, overrideSettings);
  });

  ipcMain.handle(IPC.PLUGIN_SEED_BACKEND, async (_event, pluginId?: string) => {
    return await pluginHost.seedBackend(pluginId);
  });

  ipcMain.handle(IPC.PLUGIN_TEST_MONGO, async (_event, uri?: string, dbName?: string) => {
    const connector = pluginHost.getMongoConnector();
    return await connector.testConnection(uri, dbName);
  });

  ipcMain.handle(IPC.PLUGIN_SYNC_MONGO_SEED, async () => {
    const connector = pluginHost.getMongoConnector();
    return await connector.seedAllTablesToMongo(db);
  });

  ipcMain.handle(IPC.PLUGIN_GET_LOGS, () => {
    return pluginLogger.getLogs();
  });

  ipcMain.handle(IPC.PLUGIN_DELETE_CLOUD_RECORD, async (_event, entity: string, recordId: string) => {
    try {
      const activeId = pluginHost.getActiveBackendId();
      if (activeId === 'mongodb-core') {
        const mongo = pluginHost.getMongoConnector();
        return await mongo.deleteRecord(entity, recordId);
      } else if (activeId === 'sharepoint-core') {
        const sp = pluginHost.getSharePointConnector();
        const listName = SP_ENTITY_LIST_MAP[entity] || entity;
        await sp.deleteItem(listName, recordId);
        return true;
      }
      return false;
    } catch (err: any) {
      pluginLogger.warn('PluginHost', `Failed to delete remote cloud record for ${entity} ${recordId}: ${err.message}`);
      return false;
    }
  });

  ipcMain.handle(IPC.PLUGIN_GET_APP_SETTING, (_event, key: string) => {
    try {
      const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as any;
      return row ? row.value : null;
    } catch (_) {
      return null;
    }
  });

  ipcMain.handle(IPC.PLUGIN_SET_APP_SETTING, (_event, key: string, value: string) => {
    try {
      db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).run(key, String(value));
      pluginHost.savePortableConfig();
      return true;
    } catch (_) {
      return false;
    }
  });

  // ── Unified Storage Router (routes to active backend) ─────────
  ipcMain.handle(
    IPC.STORAGE_UPLOAD_DOCUMENT,
    async (_event, fileName: string, content: any, category?: string) => {
      const provider = pluginHost.getActiveProvider();
      if (!provider) {
        throw new Error('No cloud backend provider is active. Running in local offline mode.');
      }
      return await provider.uploadDocument(fileName, content, category);
    }
  );

  ipcMain.handle(
    IPC.STORAGE_DOWNLOAD_DOCUMENT,
    async (_event, driveItemId: string) => {
      const provider = pluginHost.getActiveProvider();
      if (!provider) {
        throw new Error('No cloud backend provider is active.');
      }
      const buffer = await provider.downloadDocument(driveItemId);
      return buffer.toString('base64');
    }
  );
}
