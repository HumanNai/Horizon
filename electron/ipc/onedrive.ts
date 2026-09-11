import { IpcMain } from 'electron';
import { PluginHost } from '../plugins/plugin-host';
import { IPC } from '../../src/types';
import { sessions } from './auth';

export function registerOneDriveHandlers(ipcMain: IpcMain, pluginHost: PluginHost) {
  ipcMain.handle(
    IPC.ONEDRIVE_UPLOAD_FILE,
    async (_event, token: string, fileName: string, content: any, folderPath?: string) => {
      if (!sessions.has(token)) throw new Error('Unauthorized');
      const connector = pluginHost.getOneDriveConnector();
      return await connector.uploadFile(fileName, content, folderPath);
    }
  );

  ipcMain.handle(
    IPC.ONEDRIVE_DOWNLOAD_FILE,
    async (_event, token: string, driveItemId: string) => {
      if (!sessions.has(token)) throw new Error('Unauthorized');
      const connector = pluginHost.getOneDriveConnector();
      const buffer = await connector.downloadFile(driveItemId);
      return buffer.toString('base64');
    }
  );

  ipcMain.handle(
    IPC.ONEDRIVE_LIST_FILES,
    async (_event, token: string, folderPath?: string) => {
      if (!sessions.has(token)) throw new Error('Unauthorized');
      const connector = pluginHost.getOneDriveConnector();
      return await connector.listFiles(folderPath);
    }
  );

  ipcMain.handle(
    IPC.ONEDRIVE_DELETE_FILE,
    async (_event, token: string, driveItemId: string) => {
      if (!sessions.has(token)) throw new Error('Unauthorized');
      const connector = pluginHost.getOneDriveConnector();
      return await connector.deleteFile(driveItemId);
    }
  );
}

