import { IpcMain, Notification, app } from 'electron';
import * as path from 'path';
import Database from 'better-sqlite3';
import { IPC, ScheduleEvent } from '../../src/types';
import { sessions } from './auth';

const scheduledTimeouts = new Map<string, NodeJS.Timeout>();

function getNotificationIcon(): string {
  try {
    return process.platform === 'win32'
      ? path.join(app.getAppPath(), 'images', 'app_icon.ico')
      : path.join(app.getAppPath(), 'images', 'app_icon.png');
  } catch {
    return '';
  }
}

export function initScheduledNotifications(db: Database.Database) {
  const pending = db.prepare("SELECT * FROM schedule_events WHERE notified = 0 AND notify_at > datetime('now')").all() as any[];
  for (const event of pending) {
    schedule(event, db);
  }
}

function schedule(event: any, db: Database.Database) {
  const notifyTime = new Date(event.notify_at).getTime();
  const delay = notifyTime - Date.now();
  if (delay > 0) {
    const timeout = setTimeout(() => {
      new Notification({
        title: 'Horizon',
        body: event.title,
        icon: getNotificationIcon()
      }).show();
      db.prepare('UPDATE schedule_events SET notified = 1 WHERE id = ?').run(event.id);
      scheduledTimeouts.delete(event.id);
    }, delay);
    timeout.unref();
    scheduledTimeouts.set(event.id, timeout);
  }
}

export function registerNotificationHandlers(ipcMain: IpcMain, db: Database.Database) {
  ipcMain.handle(IPC.NOTIFY_SCHEDULE, (event, token: string, scheduleEvent: ScheduleEvent) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    
    db.prepare(`
      INSERT INTO schedule_events (id, title, type, start_date, end_date, linked_id, linked_type, notify_at, notified, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      scheduleEvent.id, scheduleEvent.title, scheduleEvent.type, scheduleEvent.startDate,
      scheduleEvent.endDate, scheduleEvent.linkedId, scheduleEvent.linkedType,
      scheduleEvent.notifyAt, scheduleEvent.createdBy
    );

    if (scheduleEvent.notifyAt) {
      const dbEvent = db.prepare('SELECT * FROM schedule_events WHERE id = ?').get(scheduleEvent.id) as any;
      schedule(dbEvent, db);
    }
    return true;
  });

  ipcMain.handle(IPC.NOTIFY_CANCEL, (event, token: string, id: string) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    const timeout = scheduledTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      scheduledTimeouts.delete(id);
    }
    db.prepare('UPDATE schedule_events SET notified = 1 WHERE id = ?').run(id);
    return true;
  });

  ipcMain.handle(IPC.NOTIFY_SEND, (_event, _token: string, payload: { title: string; body?: string }) => {
    try {
      if (Notification.isSupported()) {
        const iconPath = getNotificationIcon();
        const notif = new Notification({
          title: payload.title ? `Horizon · ${payload.title.replace(/^Horizon\s*[·-]\s*/i, '')}` : 'Horizon PM',
          body: payload.body || '',
          icon: iconPath || undefined
        });
        notif.show();
      }
      return true;
    } catch (err: any) {
      console.warn('Failed to display native notification:', err.message);
      return false;
    }
  });
}
