import { IpcMain } from 'electron';
import { PluginHost } from '../plugins/plugin-host';
import { IPC } from '../../src/types';
import { sessions } from './auth';

export function registerGraphHandlers(ipcMain: IpcMain, pluginHost: PluginHost) {
  ipcMain.handle(IPC.GRAPH_QUERY_LIST, async (event, token: string, list: string, filter?: string, select?: string, orderby?: string) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    const connector = pluginHost.getConnector('sharepoint-core');
    return connector.queryList(list, filter, select, orderby);
  });

  ipcMain.handle(IPC.GRAPH_CREATE_ITEM, async (event, token: string, list: string, fields: any) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    const connector = pluginHost.getConnector('sharepoint-core');
    return connector.createItem(list, fields);
  });

  ipcMain.handle(IPC.GRAPH_UPDATE_ITEM, async (event, token: string, list: string, itemId: string, fields: any) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    const connector = pluginHost.getConnector('sharepoint-core');
    return connector.updateItem(list, itemId, fields);
  });

  ipcMain.handle(IPC.GRAPH_DELETE_ITEM, async (event, token: string, list: string, itemId: string) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    const connector = pluginHost.getConnector('sharepoint-core');
    return connector.deleteItem(list, itemId);
  });

  ipcMain.handle(IPC.GRAPH_LIST_DOCUMENTS, async (event, token: string, library: string, folderId?: string) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    const connector = pluginHost.getConnector('sharepoint-core');
    return connector.listDocuments(library, folderId);
  });

  ipcMain.handle(IPC.GRAPH_UPLOAD_DOCUMENT, async (event, token: string, library: string, fileName: string, content: any, metadata?: any) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    const connector = pluginHost.getConnector('sharepoint-core');
    return connector.uploadDocument(library, fileName, content, metadata);
  });
}
