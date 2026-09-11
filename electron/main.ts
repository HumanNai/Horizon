import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import { runMigrations } from './db/migrations';
import { registerAuthHandlers } from './ipc/auth';
import { registerDbHandlers } from './ipc/db';
import { registerSecretsHandlers } from './ipc/secrets';
import { registerNotificationHandlers, initScheduledNotifications } from './ipc/notifications';
import { registerGraphHandlers } from './ipc/graph';
import { registerOneDriveHandlers } from './ipc/onedrive';
import { registerGoogleDriveHandlers } from './ipc/gdrive';
import { registerSyncHandlers, startSyncAgent } from './ipc/sync';
import { PluginHost, registerPluginHandlers } from './plugins/plugin-host';
import { pluginLogger } from './plugins/logger';
import { IPC } from '../src/types';

// Set Windows Application User Model ID for native OS toasts & action center
app.name = 'Horizon';
if (process.platform === 'win32') {
  app.setAppUserModelId('Horizon');
}

// Suppress benign Chromium, GPU, audio, and Bluetooth warning noise in the terminal on Windows
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-logging');
app.commandLine.appendSwitch('disable-gpu-process-crash-limit');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,AudioServiceOutOfProcess');

// Safeguard against benign window destroyed or transient pipe exit errors
process.on('uncaughtException', (err: any) => {
  if (err?.message?.includes('Object has been destroyed') || err?.message?.includes('EBUSY')) return;
  console.error('Process error:', err?.message || err);
});
process.on('unhandledRejection', (reason: any) => {
  if (reason?.message?.includes('Object has been destroyed')) return;
});

let mainWindow: BrowserWindow | null = null;
let db: Database.Database;
let pluginHost: PluginHost;

function createWindow(): BrowserWindow {
  const iconPath = process.platform === 'win32'
    ? path.join(app.getAppPath(), 'images', 'app_icon.ico')
    : path.join(app.getAppPath(), 'images', 'app_icon.png');
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 520,
    frame: false,
    title: 'Horizon — Product Management',
    backgroundColor: '#070B19',
    icon: iconPath,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.on('maximize', () => {
    win.webContents.send(IPC.WINDOW_MAXIMIZE_CHANGE, true);
  });

  win.on('unmaximize', () => {
    win.webContents.send(IPC.WINDOW_MAXIMIZE_CHANGE, false);
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

/** Seed default Product Owner account if empty */
function seedDefaultUser() {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (existing.cnt === 0) {
    const bcrypt = require('bcrypt');
    const hash = bcrypt.hashSync('horizon123', 10);
    const adminId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role, active, avatar_initials, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(adminId, 'admin', hash, 'Product Owner', 'ProductOwner', 'PO');
  }
}

/** Remove legacy dummy/sample data and testing entries if present */
function cleanDummyData() {
  try {
    const dummyProductIds = ['p-joc-01', 'p-jta-02', 'p-dfe-03', 'p-ddr-04', 'prod-1789140674118'];
    for (const pid of dummyProductIds) {
      db.prepare('DELETE FROM tasks WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM releases WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM interfaces WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM apis WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM documents_meta WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM uat_cases WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM product_custom_sections WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM product_team_members WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM schedule_events WHERE linked_id = ?').run(pid);
      db.prepare('DELETE FROM products WHERE id = ?').run(pid);
    }

    db.prepare("DELETE FROM tasks WHERE id = 'tsk-353672' OR title LIKE 'Testing Google drive%'").run();
    db.prepare("DELETE FROM products WHERE id = 'prod-1789140674118' OR (name = 'JOC' AND description = 'Jeppesen Ops Control System.')").run();
    db.prepare("DELETE FROM product_team_members WHERE product_id = 'prod-1789140674118' OR id = 'ptm-lead-prod-1789140674118'").run();
    db.prepare("DELETE FROM local_mutations WHERE payload_json LIKE '%prod-1789140674118%' OR payload_json LIKE '%tsk-353672%'").run();
    db.prepare("DELETE FROM documents_meta WHERE id IN ('doc-1', 'doc-2')").run();
    db.prepare("DELETE FROM releases WHERE id IN ('rel-v2-4-0', 'rel-v3-0-0')").run();
    db.prepare("DELETE FROM uat_cases WHERE release_id IN ('rel-v2-4-0', 'rel-v3-0-0')").run();
    db.prepare("DELETE FROM schedule_events WHERE title IN ('Phoenix v2.4.0 Production Cutover', 'UAT Final Sign-Off Gate', 'Quarterly Disaster Recovery Simulation')").run();
    db.prepare("DELETE FROM hr_records WHERE user_id IN ('Sarah Connor (Lead Dev)', 'Alex Mercer (QA Lead)', 'Elena Rostova (DevOps)', 'Product Owner')").run();
    db.prepare("DELETE FROM audit_log WHERE detail = 'Initial workspace seed completed successfully' OR action = 'SyncError'").run();

    // Clean any orphaned tasks or child entities
    db.prepare("DELETE FROM tasks WHERE product_id NOT IN (SELECT id FROM products)").run();
    db.prepare("DELETE FROM releases WHERE product_id NOT IN (SELECT id FROM products)").run();
    db.prepare("DELETE FROM interfaces WHERE product_id NOT IN (SELECT id FROM products)").run();
    db.prepare("DELETE FROM apis WHERE product_id NOT IN (SELECT id FROM products)").run();
    db.prepare("DELETE FROM documents_meta WHERE product_id IS NOT NULL AND product_id != '' AND product_id NOT IN (SELECT id FROM products)").run();
    db.prepare("DELETE FROM product_team_members WHERE product_id NOT IN (SELECT id FROM products)").run();
    db.prepare("DELETE FROM product_custom_sections WHERE product_id NOT IN (SELECT id FROM products)").run();
    db.prepare("DELETE FROM schedule_events WHERE linked_type = 'Product' AND linked_id NOT IN (SELECT id FROM products)").run();

    // Wipe all residual plugin credentials, tokens, and encryption secrets
    db.prepare(`
      UPDATE plugin_configs 
      SET settings_json = '{}', status = 'disconnected', error = NULL, connected_as = NULL, connected_at = NULL
    `).run();
    db.prepare("DELETE FROM _kv").run();
    db.prepare("DELETE FROM secrets_meta").run();
    db.prepare("DELETE FROM app_settings WHERE key = 'cloud_settings_locked_login'").run();
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('active_backend_provider', 'local', CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = 'local', updated_at = CURRENT_TIMESTAMP
    `).run();

    // Reset any portable configuration files containing credentials
    const cleanPortableConfig = {
      active_backend: "none",
      plugins: {},
      app_settings: {
        dummy_data_cleaned: "1",
        active_backend_provider: "local"
      }
    };
    const configCandidates = [
      app && typeof app.getPath === 'function' ? path.join(app.getPath('userData'), 'horizon-config.json') : null,
      path.join(process.cwd(), 'horizon-config.json'),
      process.execPath ? path.join(path.dirname(process.execPath), 'horizon-config.json') : null
    ].filter(Boolean) as string[];

    for (const cfgPath of configCandidates) {
      try {
        if (fs.existsSync(cfgPath)) {
          fs.writeFileSync(cfgPath, JSON.stringify(cleanPortableConfig, null, 2), 'utf-8');
        }
      } catch (_) {}
    }

    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('dummy_data_cleaned', '1', CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = '1'
    `).run();
  } catch (err) {
    console.error('Failed to clean dummy data and credentials:', err);
  }
}

function initApp() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'horizon.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');
  db.pragma('cache_size = -64000');
  db.pragma('mmap_size = 268435456');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  seedDefaultUser();
  cleanDummyData();
  initScheduledNotifications(db);

  pluginHost = new PluginHost(db);
  pluginHost.loadPlugin('sharepoint-core');
  pluginHost.loadPlugin('onedrive-core');
  pluginHost.loadPlugin('google-drive-core');
  pluginHost.loadPlugin('mongodb-core');
  pluginHost.loadPlugin('azure-keyvault');

  registerAuthHandlers(ipcMain, db, pluginHost);
  registerDbHandlers(ipcMain, db);
  registerSecretsHandlers(ipcMain, db, pluginHost);

  registerNotificationHandlers(ipcMain, db);
  registerGraphHandlers(ipcMain, pluginHost);
  registerOneDriveHandlers(ipcMain, pluginHost);
  registerGoogleDriveHandlers(ipcMain, pluginHost);
  registerSyncHandlers(ipcMain, db, pluginHost);
  registerPluginHandlers(ipcMain, db, pluginHost);

  // Window controls (frameless)
  ipcMain.handle(IPC.WINDOW_MINIMIZE, () => mainWindow?.minimize());
  ipcMain.handle(IPC.WINDOW_MAXIMIZE, () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    } else {
      mainWindow.maximize();
      return true;
    }
  });
  ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });
  ipcMain.handle(IPC.WINDOW_CLOSE, () => {
    try {
      mainWindow?.destroy();
    } catch {}
    try {
      db?.close();
    } catch {}
    app.exit(0);
  });
}

app.whenReady().then(() => {
  initApp();

  // Register standard editing accelerators (Undo, Redo, Cut, Copy, Paste, Select All)
  // Ensures reliable keyboard input handling in frameless Electron window
  const editMenu = Menu.buildFromTemplate([
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    }
  ]);
  Menu.setApplicationMenu(editMenu);

  mainWindow = createWindow();
  pluginLogger.registerWindow(mainWindow);
  setTimeout(() => {
    if (mainWindow) startSyncAgent(db, pluginHost, mainWindow);
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  try {
    db?.close();
  } catch {}
  app.exit(0);
});
