import { IpcMain } from 'electron';
import Database from 'better-sqlite3';
import { IPC } from '../../src/types';
import { sessions } from './auth';

export function registerDbHandlers(ipcMain: IpcMain, db: Database.Database) {
  ipcMain.handle(IPC.DB_QUERY, (event, token: string, sql: string, params: any[] = []) => {
    let effectiveToken = token;
    if (!effectiveToken && sessions.size > 0) {
      effectiveToken = Array.from(sessions.keys())[0];
    }
    if (!effectiveToken || !sessions.has(effectiveToken)) throw new Error('Unauthorized');
    return db.prepare(sql).all(...params);
  });

  ipcMain.handle(IPC.DB_EXECUTE, (event, token: string, sql: string, params: any[] = []) => {
    let effectiveToken = token;
    if (!effectiveToken && sessions.size > 0) {
      effectiveToken = Array.from(sessions.keys())[0];
    }
    if (!effectiveToken || !sessions.has(effectiveToken)) throw new Error('Unauthorized');
    const info = db.prepare(sql).run(...params);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  });
}
