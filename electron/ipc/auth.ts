import { IpcMain } from 'electron';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { IPC, SessionInfo, HorizonUser, LoginRequest } from '../../src/types';
import { PluginHost } from '../plugins/plugin-host';
import { pluginLogger } from '../plugins/logger';
import { clearSecretKey } from './secrets';

export const sessions = new Map<string, SessionInfo>();
const SECRET_KEY = crypto.randomBytes(32);

function generateToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

export function registerAuthHandlers(ipcMain: IpcMain, db: Database.Database, pluginHost: PluginHost) {
  ipcMain.handle(IPC.AUTH_LOGIN, async (event, req: LoginRequest) => {
    let userRow = db.prepare('SELECT * FROM users WHERE username = ?').get(req.username.trim()) as any;
    let valid = false;

    if (userRow) {
      valid = await bcrypt.compare(req.password, userRow.password_hash);
    }

    // If not found in local SQLite or credentials failed, check MongoDB/Cloud!
    if (!userRow || !valid) {
      try {
        pluginLogger.info('Auth', `Checking MongoDB cloud backend for user '${req.username}'...`);
        const remoteUser = await pluginHost.findUserInCloud(req.username.trim());
        if (remoteUser && remoteUser.password_hash) {
          const remoteValid = await bcrypt.compare(req.password, remoteUser.password_hash);
          if (remoteValid) {
            // Match found in Cloud! Cache or update into local SQLite
            const id = String(remoteUser.id || remoteUser._id || crypto.randomUUID());
            const username = remoteUser.username || req.username.trim();
            const passwordHash = remoteUser.password_hash;
            const displayName = remoteUser.display_name || remoteUser.displayName || username;
            const role = remoteUser.role || 'TeamMember';
            const active = remoteUser.active !== false ? 1 : 0;
            const email = remoteUser.email || null;
            const initials = remoteUser.avatar_initials || remoteUser.avatarInitials || (username.length >= 2 ? username.substring(0, 2).toUpperCase() : 'U');
            const spItemId = remoteUser.sp_item_id || remoteUser.spItemId || null;
            const createdAt = remoteUser.created_at || remoteUser.createdAt || new Date().toISOString();
            const updatedAt = remoteUser.updated_at || remoteUser.updatedAt || new Date().toISOString();

            db.prepare(`
              INSERT INTO users (id, username, password_hash, display_name, role, active, email, avatar_initials, sp_item_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                username = excluded.username,
                password_hash = excluded.password_hash,
                display_name = excluded.display_name,
                role = excluded.role,
                active = excluded.active,
                email = excluded.email,
                avatar_initials = excluded.avatar_initials,
                updated_at = excluded.updated_at
            `).run(id, username, passwordHash, displayName, role, active, email, initials, spItemId, createdAt, updatedAt);

            userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
            valid = true;
            pluginLogger.success('Auth', `Authenticated user '${username}' against MongoDB and cached to local database.`);

            // Trigger background sync to pull latest database state for this user
            setTimeout(async () => {
              try {
                const provider = pluginHost.getActiveProvider();
                if (provider) await provider.pullDeltas(db);
              } catch (_) {}
            }, 300);
          }
        }
      } catch (cloudErr: any) {
        pluginLogger.warn('Auth', `Remote cloud authentication check failed: ${cloudErr.message}`);
      }
    }

    if (!userRow || !valid) throw new Error('Invalid credentials');
    if (!userRow.active) throw new Error('Account is inactive. Please contact your Product Owner.');

    const user: HorizonUser = {
      id: userRow.id,
      username: userRow.username,
      displayName: userRow.display_name,
      role: userRow.role,
      active: Boolean(userRow.active),
      email: userRow.email,
      avatarInitials: userRow.avatar_initials,
      spItemId: userRow.sp_item_id,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at
    };

    const token = generateToken(user.id);
    const session: SessionInfo = {
      user,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    sessions.set(token, session);
    return session;
  });

  ipcMain.handle(IPC.AUTH_LOGOUT, (event, token: string) => {
    sessions.delete(token);
    clearSecretKey();
    return true;
  });

  ipcMain.handle(IPC.AUTH_GET_SESSION, (event, token: string) => {
    return sessions.get(token) || null;
  });

  ipcMain.handle(IPC.AUTH_CHANGE_PASSWORD, async (event, token: string, newPassword: string) => {
    const session = sessions.get(token);
    if (!session) throw new Error('Unauthorized');
    
    if (!newPassword || newPassword.length < 6) throw new Error('Password must be at least 6 characters');
    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, session.user.id);
    for (const [t, s] of sessions.entries()) {
      if (s.user.id === session.user.id && t !== token) sessions.delete(t);
    }
    clearSecretKey();

    // Push change to MongoDB and mutations
    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user.id) as any;
    if (updatedUser) {
      db.prepare(`
        INSERT INTO local_mutations (id, entity, sp_item_id, operation, payload_json, created_at, synced)
        VALUES (?, 'users', ?, 'UPDATE', ?, CURRENT_TIMESTAMP, 0)
      `).run(crypto.randomUUID(), session.user.id, JSON.stringify(updatedUser));
      await pluginHost.pushUserToCloud(updatedUser, 'upsert');
    }
    return true;
  });

  ipcMain.handle(IPC.AUTH_LIST_USERS, (event, token: string) => {
    const session = sessions.get(token);
    if (!session || (session.user.role !== 'ProductOwner' && session.user.role !== 'SuperAdmin')) {
      throw new Error('Unauthorized: Product Owner or Super Admin access required');
    }
    const rows = db.prepare(`
      SELECT id, username, display_name as displayName, role, active, email, avatar_initials as avatarInitials, sp_item_id as spItemId, created_at as createdAt, updated_at as updatedAt 
      FROM users ORDER BY role DESC, display_name ASC
    `).all();
    return rows.map((r: any) => ({ ...r, active: Boolean(r.active) }));
  });

  ipcMain.handle(IPC.AUTH_CREATE_USER, async (event, token: string, data: { username: string, password: string, displayName: string, role: string, email?: string, active?: boolean }) => {
    const session = sessions.get(token);
    if (!session || (session.user.role !== 'ProductOwner' && session.user.role !== 'SuperAdmin')) throw new Error('Unauthorized: Product Owner or Super Admin access required');

    const ALLOWED_ROLES = ['SuperAdmin', 'ProductOwner', 'Management', 'ProductLead', 'TeamMember'];
    const safeRole = ALLOWED_ROLES.includes(data.role) ? data.role : 'TeamMember';
    if (safeRole === 'SuperAdmin' && session.user.role !== 'SuperAdmin') {
      throw new Error('Only SuperAdmin can provision other SuperAdmin accounts');
    }

    const id = crypto.randomUUID();
    const hash = await bcrypt.hash(data.password || 'horizon123', 10);
    const rawName = (data.displayName || data.username).trim();
    const parts = rawName.split(/\s+/);
    const initials = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : rawName.substring(0, 2).toUpperCase();

    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role, active, email, avatar_initials, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, data.username.trim(), hash, data.displayName.trim(), safeRole, data.active !== false ? 1 : 0, data.email || null, initials);

    const createdRecord = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;

    // Track mutation and push to cloud
    db.prepare(`
      INSERT INTO local_mutations (id, entity, sp_item_id, operation, payload_json, created_at, synced)
      VALUES (?, 'users', ?, 'CREATE', ?, CURRENT_TIMESTAMP, 0)
    `).run(crypto.randomUUID(), id, JSON.stringify(createdRecord));

    await pluginHost.pushUserToCloud(createdRecord, 'upsert');

    return { id, username: data.username, displayName: data.displayName, role: data.role, active: data.active !== false, email: data.email, avatarInitials: initials };
  });

  ipcMain.handle(IPC.AUTH_UPDATE_USER, async (event, token: string, userId: string, updates: { displayName?: string, role?: string, email?: string, active?: boolean, password?: string }) => {
    const session = sessions.get(token);
    if (!session || (session.user.role !== 'ProductOwner' && session.user.role !== 'SuperAdmin')) throw new Error('Unauthorized: Product Owner or Super Admin access required');

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!existing) throw new Error('User not found');

    let passwordHash = existing.password_hash;
    if (updates.password && updates.password.trim()) {
      passwordHash = await bcrypt.hash(updates.password.trim(), 10);
    }

    const ALLOWED_ROLES = ['SuperAdmin', 'ProductOwner', 'Management', 'ProductLead', 'TeamMember'];
    let safeRole = existing.role;
    if (updates.role !== undefined) {
      if (!ALLOWED_ROLES.includes(updates.role)) throw new Error('Invalid role specified');
      if (updates.role === 'SuperAdmin' && session.user.role !== 'SuperAdmin') throw new Error('Only SuperAdmin can grant SuperAdmin role');
      safeRole = updates.role;
    }
    const displayName = updates.displayName !== undefined ? updates.displayName.trim() : existing.display_name;
    const role = safeRole;
    const active = updates.active !== undefined ? (updates.active ? 1 : 0) : existing.active;
    const email = updates.email !== undefined ? updates.email : existing.email;

    const parts = displayName.split(/\s+/);
    const initials = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : displayName.substring(0, 2).toUpperCase();

    db.prepare(`
      UPDATE users SET display_name = ?, role = ?, active = ?, email = ?, avatar_initials = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(displayName, role, active, email, initials, passwordHash, userId);

    const updatedRecord = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

    // Track mutation and push to cloud
    db.prepare(`
      INSERT INTO local_mutations (id, entity, sp_item_id, operation, payload_json, created_at, synced)
      VALUES (?, 'users', ?, 'UPDATE', ?, CURRENT_TIMESTAMP, 0)
    `).run(crypto.randomUUID(), userId, JSON.stringify(updatedRecord));

    await pluginHost.pushUserToCloud(updatedRecord, 'upsert');

    return true;
  });

  ipcMain.handle(IPC.AUTH_DELETE_USER, async (event, token: string, userId: string) => {
    const session = sessions.get(token);
    if (!session || (session.user.role !== 'ProductOwner' && session.user.role !== 'SuperAdmin')) throw new Error('Unauthorized: Product Owner or Super Admin access required');
    if (session.user.id === userId) throw new Error('Cannot delete your own active administrator account');

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    db.prepare(`
      INSERT INTO local_mutations (id, entity, sp_item_id, operation, payload_json, created_at, synced)
      VALUES (?, 'users', ?, 'DELETE', ?, CURRENT_TIMESTAMP, 0)
    `).run(crypto.randomUUID(), userId, JSON.stringify({ id: userId }));

    await pluginHost.pushUserToCloud(userId, 'delete');

    return true;
  });
}

