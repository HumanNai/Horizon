import { BrowserWindow } from 'electron';
import { DiagnosticLog, IPC } from '../../src/types';

class PluginLogger {
  private logs: DiagnosticLog[] = [];
  private maxLogs = 200;
  private windows: Set<BrowserWindow> = new Set();

  registerWindow(win: BrowserWindow) {
    this.windows.add(win);
    win.on('closed', () => {
      this.windows.delete(win);
    });
  }

  log(level: 'info' | 'success' | 'warn' | 'error', source: string, message: string, details?: any) {
    const entry: DiagnosticLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : undefined
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output for terminal / debugging
    const prefix = `[${entry.timestamp.split('T')[1].slice(0, 8)}] [${source}] [${level.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, message, details || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, details || '');
    } else {
      console.log(prefix, message, details || '');
    }

    // Broadcast to UI windows
    for (const win of this.windows) {
      try {
        if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
          win.webContents.send(IPC.PLUGIN_LOG_EVENT, entry);
        }
      } catch (_) {}
    }
  }

  info(source: string, message: string, details?: any) {
    this.log('info', source, message, details);
  }

  success(source: string, message: string, details?: any) {
    this.log('success', source, message, details);
  }

  warn(source: string, message: string, details?: any) {
    this.log('warn', source, message, details);
  }

  error(source: string, message: string, details?: any) {
    this.log('error', source, message, details);
  }

  getLogs(): DiagnosticLog[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}

export const pluginLogger = new PluginLogger();

