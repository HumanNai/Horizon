import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../src/types';

const horizonAPI = {
  auth: {
    login: (req: any) => ipcRenderer.invoke(IPC.AUTH_LOGIN, req),
    logout: (token: string) => ipcRenderer.invoke(IPC.AUTH_LOGOUT, token),
    getSession: (token: string) => ipcRenderer.invoke(IPC.AUTH_GET_SESSION, token),
    changePassword: (token: string, newPassword: string) => ipcRenderer.invoke(IPC.AUTH_CHANGE_PASSWORD, token, newPassword),
    listUsers: (token: string) => ipcRenderer.invoke(IPC.AUTH_LIST_USERS, token),
    createUser: (token: string, user: any) => ipcRenderer.invoke(IPC.AUTH_CREATE_USER, token, user),
    updateUser: (token: string, userId: string, updates: any) => ipcRenderer.invoke(IPC.AUTH_UPDATE_USER, token, userId, updates),
    deleteUser: (token: string, userId: string) => ipcRenderer.invoke(IPC.AUTH_DELETE_USER, token, userId)
  },
  db: {
    query: (token: string, sql: string, params?: any[]) => ipcRenderer.invoke(IPC.DB_QUERY, token, sql, params),
    execute: (token: string, sql: string, params?: any[]) => ipcRenderer.invoke(IPC.DB_EXECUTE, token, sql, params)
  },
  secrets: {
    unlock: (token: string, passphrase: string) => ipcRenderer.invoke(IPC.SECRETS_UNLOCK, token, passphrase),
    lock: (token: string) => ipcRenderer.invoke(IPC.SECRETS_LOCK, token),
    list: (token: string) => ipcRenderer.invoke(IPC.SECRETS_LIST, token),
    add: (token: string, name: string, category: string, value: string, description: string) => ipcRenderer.invoke(IPC.SECRETS_ADD, token, name, category, value, description),
    reveal: (token: string, id: string) => ipcRenderer.invoke(IPC.SECRETS_REVEAL, token, id),
    rotate: (token: string, id: string, newValue: string) => ipcRenderer.invoke(IPC.SECRETS_ROTATE, token, id, newValue),
    delete: (token: string, id: string) => ipcRenderer.invoke(IPC.SECRETS_DELETE, token, id),
    getAzureStatus: () => ipcRenderer.invoke(IPC.SECRETS_GET_AZURE_STATUS),
    listAzure: (token: string) => ipcRenderer.invoke(IPC.SECRETS_LIST_AZURE, token),
    revealAzure: (token: string, secretName: string) => ipcRenderer.invoke(IPC.SECRETS_REVEAL_AZURE, token, secretName),
    addAzure: (token: string, name: string, value: string, category?: string) => ipcRenderer.invoke(IPC.SECRETS_ADD_AZURE, token, name, value, category),
    getStatus: (token: string) => ipcRenderer.invoke(IPC.SECRETS_GET_STATUS, token),
    setupPassphrase: (token: string, passphrase: string) => ipcRenderer.invoke(IPC.SECRETS_SETUP_PASSPHRASE, token, passphrase),
    changePassphrase: (token: string, currentPassphrase: string, newPassphrase: string) => ipcRenderer.invoke(IPC.SECRETS_CHANGE_PASSPHRASE, token, currentPassphrase, newPassphrase)
  },
  graph: {
    queryList: (token: string, list: string, filter?: string, select?: string, orderby?: string) => ipcRenderer.invoke(IPC.GRAPH_QUERY_LIST, token, list, filter, select, orderby),
    createItem: (token: string, list: string, fields: any) => ipcRenderer.invoke(IPC.GRAPH_CREATE_ITEM, token, list, fields),
    updateItem: (token: string, list: string, itemId: string, fields: any) => ipcRenderer.invoke(IPC.GRAPH_UPDATE_ITEM, token, list, itemId, fields),
    deleteItem: (token: string, list: string, itemId: string) => ipcRenderer.invoke(IPC.GRAPH_DELETE_ITEM, token, list, itemId),
    listDocuments: (token: string, library: string, folderId?: string) => ipcRenderer.invoke(IPC.GRAPH_LIST_DOCUMENTS, token, library, folderId),
    uploadDocument: (token: string, library: string, fileName: string, content: any, metadata?: any) => ipcRenderer.invoke(IPC.GRAPH_UPLOAD_DOCUMENT, token, library, fileName, content, metadata)
  },
  sync: {
    trigger: () => ipcRenderer.invoke(IPC.SYNC_TRIGGER),
    getState: () => ipcRenderer.invoke(IPC.SYNC_GET_STATE),
    onStatus: (callback: (status: any) => void) => {
      ipcRenderer.on(IPC.SYNC_STATUS, (event, status) => callback(status));
    }
  },
  notify: {
    schedule: (token: string, event: any) => ipcRenderer.invoke(IPC.NOTIFY_SCHEDULE, token, event),
    cancel: (token: string, id: string) => ipcRenderer.invoke(IPC.NOTIFY_CANCEL, token, id),
    send: (payload: { title: string; body?: string }) => ipcRenderer.invoke(IPC.NOTIFY_SEND, '', payload)
  },
  plugins: {
    list: () => ipcRenderer.invoke(IPC.PLUGIN_LIST),
    saveConfig: (pluginId: string, settings: any) => ipcRenderer.invoke(IPC.PLUGIN_SAVE_CONFIG, pluginId, settings),
    connect: (pluginId: string) => ipcRenderer.invoke(IPC.PLUGIN_CONNECT, pluginId),
    disconnect: (pluginId: string) => ipcRenderer.invoke(IPC.PLUGIN_DISCONNECT, pluginId),
    getStatus: (pluginId: string) => ipcRenderer.invoke(IPC.PLUGIN_GET_STATUS, pluginId),
    getActiveBackend: () => ipcRenderer.invoke(IPC.PLUGIN_GET_ACTIVE_BACKEND),
    setActiveBackend: (providerId: string) => ipcRenderer.invoke(IPC.PLUGIN_SET_ACTIVE_BACKEND, providerId),
    testConnection: (pluginId?: string, overrideSettings?: any) => ipcRenderer.invoke(IPC.PLUGIN_TEST_CONNECTION, pluginId, overrideSettings),
    seedBackend: (pluginId?: string) => ipcRenderer.invoke(IPC.PLUGIN_SEED_BACKEND, pluginId),
    testMongo: (uri?: string, dbName?: string) => ipcRenderer.invoke(IPC.PLUGIN_TEST_MONGO, uri, dbName),
    syncMongoSeed: () => ipcRenderer.invoke(IPC.PLUGIN_SYNC_MONGO_SEED),
    getLogs: () => ipcRenderer.invoke(IPC.PLUGIN_GET_LOGS),
    deleteCloudRecord: (entity: string, recordId: string) => ipcRenderer.invoke(IPC.PLUGIN_DELETE_CLOUD_RECORD, entity, recordId),
    getAppSetting: (key: string) => ipcRenderer.invoke(IPC.PLUGIN_GET_APP_SETTING, key),
    setAppSetting: (key: string, value: string) => ipcRenderer.invoke(IPC.PLUGIN_SET_APP_SETTING, key, value),
    onLog: (callback: (log: any) => void) => {
      ipcRenderer.on(IPC.PLUGIN_LOG_EVENT, (_event, log) => callback(log));
    }
  },
  storage: {
    uploadDocument: (fileName: string, content: any, category?: string) =>
      ipcRenderer.invoke(IPC.STORAGE_UPLOAD_DOCUMENT, fileName, content, category),
    downloadDocument: (driveItemId: string) =>
      ipcRenderer.invoke(IPC.STORAGE_DOWNLOAD_DOCUMENT, driveItemId)
  },
  onedrive: {
    uploadFile: (token: string, fileName: string, content: any, folderPath?: string) =>
      ipcRenderer.invoke(IPC.ONEDRIVE_UPLOAD_FILE, token, fileName, content, folderPath),
    downloadFile: (token: string, driveItemId: string) =>
      ipcRenderer.invoke(IPC.ONEDRIVE_DOWNLOAD_FILE, token, driveItemId),
    listFiles: (token: string, folderPath?: string) =>
      ipcRenderer.invoke(IPC.ONEDRIVE_LIST_FILES, token, folderPath),
    deleteFile: (token: string, driveItemId: string) =>
      ipcRenderer.invoke(IPC.ONEDRIVE_DELETE_FILE, token, driveItemId)
  },
  gdrive: {
    uploadFile: (token: string, fileName: string, content: any, folderPath?: string) =>
      ipcRenderer.invoke(IPC.GDRIVE_UPLOAD_FILE, token, fileName, content, folderPath),
    downloadFile: (token: string, driveItemId: string) =>
      ipcRenderer.invoke(IPC.GDRIVE_DOWNLOAD_FILE, token, driveItemId),
    listFiles: (token: string, folderPath?: string) =>
      ipcRenderer.invoke(IPC.GDRIVE_LIST_FILES, token, folderPath),
    deleteFile: (token: string, driveItemId: string) =>
      ipcRenderer.invoke(IPC.GDRIVE_DELETE_FILE, token, driveItemId)
  },
  window: {
    minimize: () => ipcRenderer.invoke(IPC.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IPC.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.invoke(IPC.WINDOW_CLOSE),
    isMaximized: () => ipcRenderer.invoke(IPC.WINDOW_IS_MAXIMIZED),
    onMaximizeChange: (callback: (isMax: boolean) => void) => {
      const handler = (_event: any, isMax: boolean) => callback(isMax);
      ipcRenderer.on(IPC.WINDOW_MAXIMIZE_CHANGE, handler);
      return () => {
        ipcRenderer.removeListener(IPC.WINDOW_MAXIMIZE_CHANGE, handler);
      };
    }
  }
};

contextBridge.exposeInMainWorld('horizon', horizonAPI);

export type WindowHorizonAPI = typeof horizonAPI;
