import { IpcMain } from 'electron';
import Database from 'better-sqlite3';
import { IPC } from '../../src/types';
import { sessions } from './auth';

export function registerDbHandlers(ipcMain: IpcMain, db: Database.Database) {
  ipcMain.handle(IPC.DB_QUERY, (event, token: string, sql: string, params: any[] = []) => {
    if (!token || !sessions.has(token)) throw new Error('Unauthorized');
    const session = sessions.get(token)!;
    const normalized = (sql || '').trim().toLowerCase();

    if (normalized.includes('_kv')) {
      throw new Error('Access denied: System key-value table is protected.');
    }
    const isPrivileged = session.user?.role === 'SuperAdmin' || session.user?.role === 'ProductOwner';
    if (!isPrivileged && normalized.includes('password_hash')) {
      throw new Error('Access denied: Querying password hashes is restricted.');
    }

    return db.prepare(sql).all(...params);
  });

  ipcMain.handle(IPC.DB_EXECUTE, (event, token: string, sql: string, params: any[] = []) => {
    if (!token || !sessions.has(token)) throw new Error('Unauthorized');
    const session = sessions.get(token)!;
    const normalized = (sql || '').trim().toLowerCase();
    const isPrivileged = session.user?.role === 'SuperAdmin' || session.user?.role === 'ProductOwner';

    if (!isPrivileged) {
      if (normalized.startsWith('drop') || normalized.startsWith('alter') || normalized.startsWith('truncate')) {
        throw new Error('Access denied: Schema modification is restricted to Administrators.');
      }
      if (normalized.includes('users') || normalized.includes('_kv') || normalized.includes('audit_log') || normalized.includes('plugin_configs')) {
        throw new Error('Access denied: Direct mutation of security/audit tables is forbidden.');
      }
    }

    const info = db.prepare(sql).run(...params);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  });
}
