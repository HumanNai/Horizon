import { IpcMain } from 'electron';
import Database from 'better-sqlite3';
import { IPC } from '../../src/types';
import { sessions } from './auth';
import { validateSafeQuery, validateSafeExecute, sanitizeRows } from '../../src/utils/sqlSecurity';

export function registerDbHandlers(ipcMain: IpcMain, db: Database.Database) {
  ipcMain.handle(IPC.DB_QUERY, (event, token: string, sql: string, params: any[] = []) => {
    if (!token || !sessions.has(token)) throw new Error('Unauthorized');
    const safeSql = validateSafeQuery(sql);
    const rows = db.prepare(safeSql).all(...params);
    return sanitizeRows(rows);
  });

  ipcMain.handle(IPC.DB_EXECUTE, (event, token: string, sql: string, params: any[] = []) => {
    if (!token || !sessions.has(token)) throw new Error('Unauthorized');
    const session = sessions.get(token)!;
    const safeSql = validateSafeExecute(sql, session.user.role);
    const info = db.prepare(safeSql).run(...params);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  });
}
