import { IpcMain, BrowserWindow } from 'electron';
import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import { PluginHost } from '../plugins/plugin-host';
import { pluginLogger } from '../plugins/logger';
import { IPC, SyncState } from '../../src/types';
import { TRACKED_ENTITIES } from '../plugins/types';

const SYNC_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

function logSyncAudit(db: Database.Database, action: string, detail: string) {
  try {
    db.prepare(
      `INSERT INTO audit_log (id, user_id, action, detail, created_at)
       VALUES (?, 'system', ?, ?, CURRENT_TIMESTAMP)`
    ).run(crypto.randomUUID(), action, detail);
  } catch (_) {}
}

// ── Main sync cycle ───────────────────────────────────────────
export async function runSync(
  db: Database.Database,
  pluginHost: PluginHost,
  mainWindow: BrowserWindow
) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents?.isDestroyed()) {
    return;
  }

  const sendStatus = (state: Partial<SyncState>) => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents?.isDestroyed()) return;
    try {
      mainWindow.webContents.send(IPC.SYNC_STATUS, state);
    } catch {}
  };

  const provider = pluginHost.getActiveProvider();
  if (!provider) {
    sendStatus({ status: 'offline', pendingChanges: 0 });
    return;
  }

  const pendingCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM local_mutations WHERE synced = 0').get() as any
  ).cnt;

  sendStatus({ status: 'syncing', pendingChanges: pendingCount });
  pluginLogger.info('SyncAgent', `Initiating sync cycle for [${provider.name}] (${pendingCount} pending mutations)...`);

  try {
    // 1. Push local mutations via the active provider
    await provider.pushMutations(db);

    // 2. Pull remote deltas via the active provider
    await provider.pullDeltas(db);

    // 3. Update sync timestamps
    const now = new Date().toISOString();
    const upsertSync = db.prepare(
      `INSERT OR REPLACE INTO sync_state (entity, last_sync_at) VALUES (?, ?)`
    );
    for (const entity of TRACKED_ENTITIES) {
      upsertSync.run(entity, now);
    }

    const remaining = (
      db.prepare('SELECT COUNT(*) as cnt FROM local_mutations WHERE synced = 0').get() as any
    ).cnt;

    sendStatus({ status: 'idle', lastSyncAt: now, pendingChanges: remaining });
    logSyncAudit(db, 'SyncSuccess', `[${provider.name}] Synced at ${now}, pending mutations: ${remaining}`);
    pluginLogger.success('SyncAgent', `[${provider.name}] Sync cycle complete. Pending mutations remaining: ${remaining}`);
  } catch (err: any) {
    const errorMsg = err.response?.data?.error?.message || err.message || 'Sync failed';
    sendStatus({ status: 'error', error: errorMsg, pendingChanges: pendingCount });
    logSyncAudit(db, 'SyncError', `[${provider.name}] ${errorMsg}`);
    pluginLogger.error('SyncAgent', `[${provider.name}] Sync failed: ${errorMsg}`);
  }
}

// ── Public API ────────────────────────────────────────────────
export function startSyncAgent(
  db: Database.Database,
  pluginHost: PluginHost,
  mainWindow: BrowserWindow
) {
  const t1 = setTimeout(() => {
    if (!mainWindow.isDestroyed()) {
      runSync(db, pluginHost, mainWindow).catch(() => {});
    }
  }, 5000);

  const t2 = setInterval(() => {
    if (!mainWindow.isDestroyed()) {
      runSync(db, pluginHost, mainWindow).catch(() => {});
    }
  }, SYNC_INTERVAL_MS);

  t1.unref();
  t2.unref();
}

export function registerSyncHandlers(
  ipcMain: IpcMain,
  db: Database.Database,
  pluginHost: PluginHost
) {
  ipcMain.handle(IPC.SYNC_TRIGGER, async (_event) => {
    const wins = BrowserWindow.getAllWindows();
    if (wins[0] && !wins[0].isDestroyed()) {
      await runSync(db, pluginHost, wins[0]).catch(() => {});
    }
    return true;
  });

  ipcMain.handle(IPC.SYNC_GET_STATE, () => {
    const pending = (
      db.prepare('SELECT COUNT(*) as cnt FROM local_mutations WHERE synced = 0').get() as any
    ).cnt;
    const syncRow = db.prepare('SELECT MIN(last_sync_at) as t FROM sync_state').get() as any;
    const provider = pluginHost.getActiveProvider();

    return {
      status: provider ? 'idle' : 'offline',
      lastSyncAt: syncRow?.t ?? undefined,
      pendingChanges: pending,
    } as SyncState;
  });
}
