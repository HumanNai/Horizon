import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { runMigrations } from '../electron/db/migrations';
import { PluginHost } from '../electron/plugins/plugin-host';
import { pluginLogger } from '../electron/plugins/logger';
import { SessionInfo, HorizonUser, UserRole } from '../src/types';

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || process.env.CORS_ORIGIN || '';
app.use(cors({
  origin: (origin, callback) => {
    // Non-browser / same-origin requests (curl, server-to-server) have no Origin header
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) return callback(null, true);
    callback(new Error(`CORS blocked: origin ${origin} is not permitted`));
  },
  credentials: true
}));
app.use(express.json({ limit: process.env.MAX_REQUEST_SIZE || '50mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_REQUEST_SIZE || '50mb' }));
app.use(morgan('[:date[iso]] :method :url :status :res[content-length] - :response-time ms'));

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 5 minutes before retrying.' }
});
// ── Structured Server-Side Error Logging ────────────────────
function logServerError(context: string, err: any, req?: Request) {
  const ts = new Date().toISOString();
  const msg = err?.message || String(err);
  const stack = err?.stack ? `\n  ${err.stack.split('\n').slice(1, 4).join('\n  ')}` : '';
  console.error(`[${ts}] [ERROR] [${context}]${req ? ` ${req.method} ${req.url}` : ''} — ${msg}${stack}`);
}

// Persist critical errors to audit_log (best-effort)
function auditServerError(context: string, err: any, userId?: string) {
  try {
    const id = crypto.randomUUID();
    const msg = String(err?.message || err).substring(0, 500);
    db.prepare(
      `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, detail, created_at)
       VALUES (?, ?, 'SERVER_ERROR', 'System', ?, ?, CURRENT_TIMESTAMP)`
    ).run(id, userId || 'system', context, msg);
  } catch (_) { /* audit insert must never crash the process */ }
}


// ── Database Initialization (Pluggable SQLite default) ───────
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'horizon.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

runMigrations(db);

// ── Ensure Default SuperAdmin & ProductOwner exist ───────────
function seedDefaultUsers() {
  const existingSuper = db.prepare("SELECT id FROM users WHERE role = 'SuperAdmin' OR username = 'superadmin'").get() as any;
  if (!existingSuper) {
    const hash = bcrypt.hashSync('horizon123', 10);
    const saId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role, active, avatar_initials, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(saId, 'superadmin', hash, 'Super Administrator', 'SuperAdmin', 'SA');
    pluginLogger.info('WebHosting', 'Created default superadmin account (username: superadmin / pass: horizon123)');
  }

  const existingPO = db.prepare("SELECT id FROM users WHERE username = 'admin'").get() as any;
  if (!existingPO) {
    const hash = bcrypt.hashSync('horizon123', 10);
    const adminId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role, active, avatar_initials, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(adminId, 'admin', hash, 'Product Owner', 'ProductOwner', 'PO');
    pluginLogger.info('WebHosting', 'Created default admin account (username: admin / pass: horizon123)');
  }
}
seedDefaultUsers();

// ── Initialize Pluggable Plugins Host ────────────────────────
const pluginHost = new PluginHost(db);
pluginHost.loadPlugin('sharepoint-core');
pluginHost.loadPlugin('onedrive-core');
pluginHost.loadPlugin('google-drive-core');
pluginHost.loadPlugin('mongodb-core');
pluginHost.loadPlugin('azure-keyvault');
pluginHost.loadPlugin('azure-ad');

// ── In-Memory Sessions ───────────────────────────────────────
// ── Node.js process-level error safety nets ─────────────────
process.on('unhandledRejection', (reason: any) => {
  logServerError('UnhandledRejection', reason);
});
process.on('uncaughtException', (err: Error) => {
  logServerError('UncaughtException', err);
});
function getOrCreateSessionSecret(): Buffer {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS _kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    const row = db.prepare("SELECT value FROM _kv WHERE key = 'session_secret'").get() as any;
    if (row && row.value) {
      return Buffer.from(row.value, 'hex');
    }
    const secret = crypto.randomBytes(32);
    db.prepare("INSERT INTO _kv (key, value) VALUES ('session_secret', ?)").run(secret.toString('hex'));
    return secret;
  } catch {
    return crypto.randomBytes(32);
  }
}

const sessions = new Map<string, SessionInfo>();
const activeOAuthStates = new Set<string>();
const SECRET_KEY = getOrCreateSessionSecret();

function generateToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized: Session invalid or expired' });
  }

  const session = sessions.get(token)!;
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    sessions.delete(token);
    vaultKeys.delete(token);
    return res.status(401).json({ error: 'Unauthorized: Session has expired. Please log in again.' });
  }

  (req as any).userSession = session;
  (req as any).sessionToken = token;
  next();
};

setInterval(() => {
  const now = Date.now();
  for (const [t, s] of sessions.entries()) {
    if (s.expiresAt && new Date(s.expiresAt).getTime() < now) {
      sessions.delete(t);
      vaultKeys.delete(t);
    }
  }
}, 15 * 60 * 1000).unref();

// ── 1. Authentication Routes ─────────────────────────────────
app.post('/api/auth/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    let userRow = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as any;
    let valid = false;

    if (userRow) {
      valid = await bcrypt.compare(password, userRow.password_hash);
    }

    // Check remote cloud (MongoDB Atlas) if enabled
    if (!userRow || !valid) {
      try {
        const remoteUser = await pluginHost.findUserInCloud(username.trim());
        if (remoteUser && remoteUser.password_hash) {
          valid = await bcrypt.compare(password, remoteUser.password_hash);
          if (valid) {
            const id = String(remoteUser.id || remoteUser._id || crypto.randomUUID());
            userRow = {
              id,
              username: remoteUser.username || username.trim(),
              password_hash: remoteUser.password_hash,
              display_name: remoteUser.display_name || remoteUser.displayName || username,
              role: remoteUser.role || 'TeamMember',
              active: remoteUser.active !== false ? 1 : 0,
              email: remoteUser.email || null,
              avatar_initials: remoteUser.avatar_initials || 'U'
            };
            db.prepare(`
              INSERT INTO users (id, username, password_hash, display_name, role, active, email, avatar_initials, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, role = excluded.role
            `).run(userRow.id, userRow.username, userRow.password_hash, userRow.display_name, userRow.role, userRow.active, userRow.email, userRow.avatar_initials);
          }
        }
      } catch (_) {}
    }

    if (!userRow || !valid) return res.status(401).json({ error: 'Invalid username or password' });
    if (!userRow.active) return res.status(403).json({ error: 'Account has been deactivated' });

    const token = generateToken(userRow.id);
    const user: HorizonUser = {
      id: userRow.id,
      username: userRow.username,
      displayName: userRow.display_name,
      role: userRow.role as UserRole,
      active: Boolean(userRow.active),
      email: userRow.email,
      avatarInitials: userRow.avatar_initials,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at
    };

    const sessionInfo: SessionInfo = {
      user,
      token,
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };
    sessions.set(token, sessionInfo);

    res.json(sessionInfo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '') || (req.body?.token as string);
  if (token) {
    sessions.delete(token);
    vaultKeys.delete(token);
  }
  res.json({ success: true });
});

app.get('/api/auth/session', (req: Request, res: Response) => {
  const token = (req.query.token as string) || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : '');
  if (!token || !sessions.has(token)) return res.json(null);
  res.json(sessions.get(token));
});

app.post('/api/auth/change-password', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  const currentToken = (req as any).sessionToken;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, session.user.id);

  // Invalidate all other active sessions for this user across memory
  for (const [t, s] of sessions.entries()) {
    if (s.user.id === session.user.id && t !== currentToken) {
      sessions.delete(t);
      vaultKeys.delete(t);
    }
  }

  res.json({ success: true });
});

app.get('/api/auth/users', authMiddleware, (req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT id, username, display_name as displayName, role, active, email, avatar_initials as avatarInitials, created_at as createdAt, updated_at as updatedAt
    FROM users ORDER BY role DESC, display_name ASC
  `).all();
  res.json(rows.map((r: any) => ({ ...r, active: Boolean(r.active) })));
});

app.post('/api/auth/users', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (session.user.role !== 'ProductOwner' && session.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Unauthorized: Product Owner or Super Admin role required' });
  }

  const { username, password, displayName, role, email, active } = req.body;
  if (!username || !displayName) {
    return res.status(400).json({ error: 'Username and display name are required' });
  }

  const ALLOWED_ROLES = ['SuperAdmin', 'ProductOwner', 'Management', 'ProductLead', 'TeamMember'];
  const safeRole = ALLOWED_ROLES.includes(role) ? role : 'TeamMember';

  // Prevent non-SuperAdmins from creating SuperAdmins
  if (safeRole === 'SuperAdmin' && session.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Only SuperAdmin can provision other SuperAdmin accounts' });
  }

  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(password || 'horizon123', 10);
  const rawName = displayName.trim();
  const parts = rawName.split(/\s+/);
  const initials = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : rawName.substring(0, 2).toUpperCase();

  db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role, active, email, avatar_initials, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(id, username.trim(), hash, rawName, safeRole, active !== false ? 1 : 0, email || null, initials);

  res.json({ id, username, displayName: rawName, role: safeRole, active: active !== false, email, avatarInitials: initials });
});

// ── 2. Microsoft Entra ID (Azure AD) SSO Endpoints ───────────
app.get('/api/auth/azure-ad/url', async (req: Request, res: Response) => {
  try {
    const connector = pluginHost.getAzureADConnector();
    const state = crypto.randomBytes(16).toString('hex');
    activeOAuthStates.add(state);
    setTimeout(() => activeOAuthStates.delete(state), 10 * 60 * 1000).unref();
    const url = await connector.getAuthUrl(state);
    res.json({ url, state });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Azure AD SSO not configured' });
  }
});

app.post('/api/auth/azure-ad/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code required' });
    if (!state || !activeOAuthStates.has(state)) {
      return res.status(400).json({ error: 'Invalid or expired OAuth state parameter (CSRF protection)' });
    }
    activeOAuthStates.delete(state);

    const connector = pluginHost.getAzureADConnector();
    const { profile, role } = await connector.exchangeCode(code);

    // Find or provision user in Horizon database
    let userRow = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(profile.mail || profile.userPrincipalName, profile.userPrincipalName) as any;
    let userId = userRow?.id;

    if (!userRow) {
      userId = crypto.randomUUID();
      const initials = (profile.displayName.substring(0, 2) || 'AD').toUpperCase();
      const tempHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

      db.prepare(`
        INSERT INTO users (id, username, password_hash, display_name, role, active, email, avatar_initials, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(userId, profile.userPrincipalName, tempHash, profile.displayName, role, profile.mail || profile.userPrincipalName, initials);
    } else {
      // Update role if synced from Azure AD group
      db.prepare(`
        UPDATE users 
        SET role = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(role, profile.displayName, userId);
    }

    userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const token = generateToken(userId);
    const user: HorizonUser = {
      id: userRow.id,
      username: userRow.username,
      displayName: userRow.display_name,
      role: userRow.role as UserRole,
      active: Boolean(userRow.active),
      email: userRow.email,
      avatarInitials: userRow.avatar_initials,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at
    };

    const sessionInfo: SessionInfo = {
      user,
      token,
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };
    sessions.set(token, sessionInfo);

    res.json(sessionInfo);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Azure AD authentication failed' });
  }
});

// ── SQL Query & Execution Safety Helpers ─────────────────────
function sanitizeSql(sql: string): string {
  if (!sql || typeof sql !== 'string') throw new Error('Invalid SQL: Empty query string.');
  let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  cleaned = cleaned.replace(/--.*$/gm, ' ');
  cleaned = cleaned.trim();
  const statements = cleaned.split(';').map(s => s.trim()).filter(Boolean);
  if (statements.length > 1) {
    throw new Error('Access denied: Multiple SQL statements are not permitted.');
  }
  return statements[0] || '';
}

function validateSafeQuery(sql: string): string {
  const cleaned = sanitizeSql(sql);
  if (!/^(select|with)\b/i.test(cleaned)) {
    throw new Error('Access denied: Only SELECT queries are permitted on this endpoint.');
  }
  if (/\b(drop|alter|truncate|attach|detach|pragma|vacuum|reindex)\b/i.test(cleaned)) {
    throw new Error('Access denied: DDL and administrative commands are forbidden.');
  }
  if (/\b(_kv|_migrations)\b/i.test(cleaned)) {
    throw new Error('Access denied: System key-value and migration tables are protected.');
  }
  if (/\bpassword_hash\b/i.test(cleaned) || /\bselect\s+\*\s+from\s+users\b/i.test(cleaned)) {
    throw new Error('Access denied: Querying credential hashes directly is strictly prohibited.');
  }
  return cleaned;
}

function validateSafeExecute(sql: string): string {
  const cleaned = sanitizeSql(sql);
  if (!/^(insert|update|delete|replace)\b/i.test(cleaned)) {
    throw new Error('Access denied: Only INSERT, UPDATE, or DELETE operations are permitted.');
  }
  if (/\b(drop|alter|truncate|attach|detach|pragma|vacuum|reindex|create)\b/i.test(cleaned)) {
    throw new Error('Access denied: Schema alterations are restricted to migration scripts.');
  }
  if (/\b(users|_kv|_migrations|audit_log|plugin_configs)\b/i.test(cleaned)) {
    throw new Error('Access denied: Direct mutation of security/audit/user tables is forbidden.');
  }
  return cleaned;
}

function sanitizeRows(rows: any[]): any[] {
  if (!Array.isArray(rows)) return rows;
  for (const row of rows) {
    if (row && typeof row === 'object') {
      delete row.password_hash;
      delete row.password;
    }
  }
  return rows;
}

// ── 3. Database Execution Routes ─────────────────────────────
app.post('/api/db/query', authMiddleware, (req: Request, res: Response) => {
  try {
    const { sql, params = [] } = req.body;
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/db/execute', authMiddleware, (req: Request, res: Response) => {
  try {
    const { sql, params = [] } = req.body;
    const info = db.prepare(sql).run(...params);
    res.json({ changes: info.changes, lastInsertRowid: info.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── Helper: Product Team Authorization Check ─────────────────
function hasProductAccess(userId: string, userRole: string, userName: string, userDisplayName: string, productId: string): boolean {
  if (userRole === 'SuperAdmin' || userRole === 'ProductOwner' || userRole === 'Management') return true;
  const prod = db.prepare('SELECT owner_id FROM products WHERE id = ?').get(productId) as any;
  if (prod && (prod.owner_id === userId || prod.owner_id === userName || prod.owner_id === userDisplayName)) return true;
  const member = db.prepare(
    'SELECT id FROM product_team_members WHERE product_id = ? AND (user_id = ? OR user_id = ? OR user_id = ?)'
  ).get(productId, userId, userName, userDisplayName);
  return Boolean(member);
}

// ── 4. Integration Mapping Routes ────────────────────────────
app.get('/api/integration/maps', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  const productId = req.query.productId as string;
  if (!productId || !hasProductAccess(session.user.id, session.user.role, session.user.username, session.user.displayName, productId)) {
    return res.status(403).json({ error: 'Access denied: You are not authorized for this product.' });
  }
  const rows = db.prepare(`
    SELECT id, product_id as productId, name, description, imported_at as importedAt, created_by as createdBy, created_at as createdAt
    FROM integration_maps
    WHERE product_id = ?
    ORDER BY created_at DESC
  `).all(productId);
  res.json(rows);
});

app.post('/api/integration/maps', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  const { productId, name, description } = req.body;
  if (!productId || !hasProductAccess(session.user.id, session.user.role, session.user.username, session.user.displayName, productId)) {
    return res.status(403).json({ error: 'Access denied: You are not authorized to create maps for this product.' });
  }
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO integration_maps (id, product_id, name, description, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(id, productId, name, description || '', session.user.displayName || session.user.username);
  res.json({ id, productId, name, description });
});

app.delete('/api/integration/maps/:id', authMiddleware, (req: Request, res: Response) => {
  const mapId = req.params.id;
  const deleteTx = db.transaction(() => {
    db.prepare('DELETE FROM integration_nodes WHERE map_id = ?').run(mapId);
    db.prepare('DELETE FROM integration_edges WHERE map_id = ?').run(mapId);
    db.prepare('DELETE FROM integration_groups WHERE map_id = ?').run(mapId);
    db.prepare('DELETE FROM integration_maps WHERE id = ?').run(mapId);
  });
  deleteTx();
  res.json({ success: true });
});

app.get('/api/integration/maps/:id/data', authMiddleware, (req: Request, res: Response) => {
  const mapId = req.params.id;
  const map = db.prepare(`
    SELECT id, product_id as productId, name, description, imported_at as importedAt, created_by as createdBy, created_at as createdAt
    FROM integration_maps WHERE id = ?
  `).get(mapId) as any;

  const nodes = db.prepare(`
    SELECT id, map_id as mapId, node_key as nodeKey, label, node_type as nodeType, team_owner as teamOwner,
           tech_stack as techStack, environment, criticality, notes, pos_x as posX, pos_y as posY
    FROM integration_nodes WHERE map_id = ?
  `).all(mapId);

  const edges = db.prepare(`
    SELECT id, map_id as mapId, edge_key as edgeKey, from_node as fromNode, to_node as toNode,
           protocol, direction, data_format as dataFormat, frequency, criticality, status, notes
    FROM integration_edges WHERE map_id = ?
  `).all(mapId);

  const groups = db.prepare(`
    SELECT id, map_id as mapId, group_key as groupKey, label, node_keys as nodeKeys, color
    FROM integration_groups WHERE map_id = ?
  `).all(mapId);

  const parsedGroups = groups.map((g: any) => ({
    ...g,
    nodeKeys: g.nodeKeys ? JSON.parse(g.nodeKeys) : []
  }));

  res.json({ map, nodes, edges, groups: parsedGroups });
});

app.post('/api/integration/import', authMiddleware, (req: Request, res: Response) => {
  const { mapId, nodes, edges, groups = [] } = req.body;
  const importTx = db.transaction(() => {
    db.prepare('DELETE FROM integration_nodes WHERE map_id = ?').run(mapId);
    db.prepare('DELETE FROM integration_edges WHERE map_id = ?').run(mapId);
    db.prepare('DELETE FROM integration_groups WHERE map_id = ?').run(mapId);

    const insertNode = db.prepare(`
      INSERT INTO integration_nodes (id, map_id, node_key, label, node_type, team_owner, tech_stack, environment, criticality, notes, pos_x, pos_y)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    nodes.forEach((n: any, idx: number) => {
      const id = crypto.randomUUID();
      const cols = 4;
      const defaultX = (idx % cols) * 280 + 50;
      const defaultY = Math.floor(idx / cols) * 160 + 50;

      insertNode.run(
        id,
        mapId,
        String(n.node_id || n.nodeKey || id),
        String(n.node_label || n.label || n.node_id || 'System'),
        String(n.node_type || n.nodeType || 'Application'),
        n.team_owner || n.teamOwner || null,
        n.tech_stack || n.techStack || null,
        n.environment || 'Prod',
        n.criticality || 'Medium',
        n.notes || null,
        n.pos_x ?? n.posX ?? defaultX,
        n.pos_y ?? n.posY ?? defaultY
      );
    });

    const insertEdge = db.prepare(`
      INSERT INTO integration_edges (id, map_id, edge_key, from_node, to_node, protocol, direction, data_format, frequency, criticality, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    edges.forEach((e: any) => {
      const id = crypto.randomUUID();
      insertEdge.run(
        id,
        mapId,
        String(e.edge_id || e.edgeKey || id),
        String(e.from_node || e.fromNode),
        String(e.to_node || e.toNode),
        e.protocol || 'REST',
        e.direction || 'Unidirectional',
        e.data_format || e.dataFormat || 'JSON',
        e.frequency || 'Real-time',
        e.criticality || 'Medium',
        e.status || 'Active',
        e.notes || null
      );
    });

    db.prepare('UPDATE integration_maps SET imported_at = CURRENT_TIMESTAMP WHERE id = ?').run(mapId);
  });

  importTx();
  res.json({ success: true });
});

app.post('/api/integration/positions', authMiddleware, (req: Request, res: Response) => {
  const { positions = [] } = req.body;
  const updateStmt = db.prepare(`
    UPDATE integration_nodes
    SET pos_x = ?, pos_y = ?
    WHERE map_id = ? AND (id = ? OR node_key = ?)
  `);

  const updateTx = db.transaction(() => {
    for (const pos of positions) {
      updateStmt.run(pos.posX, pos.posY, pos.mapId, pos.id || '', pos.nodeKey || '');
    }
  });

  updateTx();
  res.json({ success: true });
});

// ── 5. Plugins API Routes ────────────────────────────────────
app.get('/api/plugins/list', authMiddleware, (req: Request, res: Response) => {
  res.json(pluginHost.listPlugins());
});

app.post('/api/plugins/:id/config', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (session.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Super Admin authority required for plugin modifications' });
  }
  pluginHost.saveConfig(req.params.id, req.body.settings);
  res.json({ success: true });
});

app.post('/api/plugins/:id/connect', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (session.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Super Admin authority required' });
  }

  const pluginId = req.params.id;
  try {
    pluginHost.loadPlugin(pluginId);
    if (pluginId === 'azure-ad') {
      const connector = pluginHost.getAzureADConnector();
      const test = await connector.testConnection();
      if (!test.success) throw new Error(test.message);
      db.prepare("UPDATE plugin_configs SET status = 'connected', connected_as = 'Entra ID Verified', connected_at = CURRENT_TIMESTAMP WHERE plugin_id = ?").run(pluginId);
      return res.json({ success: true, connectedAs: 'Entra ID Verified' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/plugins/active-backend', authMiddleware, (req: Request, res: Response) => {
  res.json(pluginHost.getActiveBackendId());
});

app.post('/api/plugins/active-backend', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (session.user.role !== 'SuperAdmin' && session.user.role !== 'ProductOwner') {
    return res.status(403).json({ error: 'Unauthorized: SuperAdmin or ProductOwner role required' });
  }
  pluginHost.setActiveBackendId(req.body.providerId);
  res.json({ success: true });
});

app.post('/api/plugins/test-connection', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await pluginHost.testBackend(req.body.pluginId, req.body.overrideSettings);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/plugins/seed-backend', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (session.user.role !== 'SuperAdmin' && session.user.role !== 'ProductOwner') {
    return res.status(403).json({ error: 'Super Admin or Product Owner role required' });
  }
  try {
    const result = await pluginHost.seedBackend(req.body.pluginId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/plugins/test-mongo', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (session.user.role !== 'SuperAdmin' && session.user.role !== 'ProductOwner') {
    return res.status(403).json({ error: 'Super Admin or Product Owner role required' });
  }
  try {
    const connector = pluginHost.getMongoConnector();
    const result = await connector.testConnection(req.body.uri, req.body.dbName);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/plugins/sync-mongo-seed', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (session.user.role !== 'SuperAdmin' && session.user.role !== 'ProductOwner') {
    return res.status(403).json({ error: 'Super Admin or Product Owner role required' });
  }
  try {
    const connector = pluginHost.getMongoConnector();
    const result = await connector.seedAllTablesToMongo(db);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/plugins/logs', authMiddleware, (_req: Request, res: Response) => {
  res.json(pluginLogger.getLogs());
});

app.delete('/api/plugins/cloud-record', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (session.user.role !== 'SuperAdmin' && session.user.role !== 'ProductOwner') {
    return res.status(403).json({ error: 'Super Admin or Product Owner role required' });
  }
  try {
    const { entity, recordId } = req.body;
    const activeId = pluginHost.getActiveBackendId();
    if (activeId === 'mongodb-core') {
      const mongo = pluginHost.getMongoConnector();
      const result = await mongo.deleteRecord(entity, recordId);
      return res.json(result);
    } else if (activeId === 'sharepoint-core') {
      const sp = pluginHost.getSharePointConnector();
      const listName = SP_ENTITY_LIST_MAP[entity] || entity;
      await sp.deleteItem(listName, recordId);
      return res.json(true);
    }
    res.json(false);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/plugins/setting/:key', authMiddleware, (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(req.params.key) as any;
    res.json(row ? row.value : null);
  } catch {
    res.json(null);
  }
});

app.post('/api/plugins/setting', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (session.user.role !== 'SuperAdmin' && session.user.role !== 'ProductOwner') {
    return res.status(403).json({ error: 'Super Admin or Product Owner role required' });
  }
  try {
    const { key, value } = req.body;
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, String(value));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── 4a. Secrets Vault Routes ─────────────────────────────────
// In-memory per-session vault state: token → { key: Buffer | null }
const vaultKeys = new Map<string, Buffer | null>();

const VAULT_ALGORITHM = 'aes-256-gcm';
const VAULT_IV_LEN = 12;
const VAULT_TAG_LEN = 16;
const VAULT_ITERATIONS = 210000;
const VAULT_KEY_LEN = 32;

function vaultEncrypt(text: string, key: Buffer): string {
  const iv = crypto.randomBytes(VAULT_IV_LEN);
  const cipher = crypto.createCipheriv(VAULT_ALGORITHM, key, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, Buffer.from(enc, 'hex')]).toString('base64');
}

function vaultDecrypt(encText: string, key: Buffer): string {
  const data = Buffer.from(encText, 'base64');
  const iv = data.subarray(0, VAULT_IV_LEN);
  const tag = data.subarray(VAULT_IV_LEN, VAULT_IV_LEN + VAULT_TAG_LEN);
  const enc = data.subarray(VAULT_IV_LEN + VAULT_TAG_LEN);
  const decipher = crypto.createDecipheriv(VAULT_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let dec = decipher.update(enc, undefined, 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

function getOrCreateVaultSalt(): string {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS _kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    const row = db.prepare("SELECT value FROM _kv WHERE key = 'vault_salt'").get() as any;
    if (row) return row.value;
    const salt = crypto.randomBytes(32).toString('hex');
    db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_salt', ?)").run(salt);
    return salt;
  } catch { return crypto.randomBytes(32).toString('hex'); }
}

function getVaultVerifier(): string | null {
  try {
    const row = db.prepare("SELECT value FROM _kv WHERE key = 'vault_verifier'").get() as any;
    return row?.value || null;
  } catch { return null; }
}

const VAULT_SENTINEL = 'HORIZON_VAULT_ENCRYPTED_SENTINEL_V1';

function logSecretAudit(userId: string, action: string, entityId: string) {
  try {
    db.prepare(
      `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, 'Secret', ?, CURRENT_TIMESTAMP)`
    ).run(crypto.randomUUID(), userId, action, entityId);
  } catch (_) {}
}

app.get('/api/secrets/status', authMiddleware, (req: Request, res: Response) => {
  try {
    const token = (req as any).sessionToken;
    const verifier = getVaultVerifier();
    let lastRotatedAt: string | null = null;
    try {
      const row = db.prepare("SELECT value FROM _kv WHERE key = 'vault_last_rotated'").get() as any;
      lastRotatedAt = row?.value || null;
    } catch {}
    res.json({ isInitialized: Boolean(verifier), isUnlocked: Boolean(vaultKeys.get(token)), lastRotatedAt });
  } catch (err: any) {
    logServerError('/api/secrets/status', err, req);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/secrets/setup-passphrase', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  const token = (req as any).sessionToken;
  if (session.user.role !== 'ProductOwner' && session.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Only Product Owners can set up the vault passphrase' });
  }
  const passphrase = (req.body.passphrase || '').trim();
  if (!passphrase || passphrase.length < 6) return res.status(400).json({ error: 'Passphrase must be at least 6 characters' });
  if (getVaultVerifier()) return res.status(409).json({ error: 'Vault already initialized. Use change-passphrase.' });
  try {
    const salt = crypto.randomBytes(32).toString('hex');
    db.exec(`CREATE TABLE IF NOT EXISTS _kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_salt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(salt);
    const key = await new Promise<Buffer>((res, rej) => crypto.pbkdf2(passphrase, salt, VAULT_ITERATIONS, VAULT_KEY_LEN, 'sha256', (e, k) => e ? rej(e) : res(k)));
    const verifierBlob = vaultEncrypt(VAULT_SENTINEL, key);
    db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_verifier', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(verifierBlob);
    db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_last_rotated', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(new Date().toISOString());
    vaultKeys.set(token, key);
    logSecretAudit(session.user.id, 'VaultPassphraseInitialized', 'MasterVault');
    res.json(true);
  } catch (err: any) {
    logServerError('/api/secrets/setup-passphrase', err, req);
    auditServerError('secrets/setup-passphrase', err, session.user.id);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/secrets/unlock', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  const token = (req as any).sessionToken;
  const passphrase = (req.body.passphrase || '').trim();
  if (!passphrase) return res.status(400).json({ error: 'Passphrase is required' });
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS _kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    const salt = getOrCreateVaultSalt();
    const key = await new Promise<Buffer>((resolve, reject) => crypto.pbkdf2(passphrase, salt, VAULT_ITERATIONS, VAULT_KEY_LEN, 'sha256', (e, k) => e ? reject(e) : resolve(k)));
    const verifier = getVaultVerifier();
    if (verifier) {
      let check: string;
      try { check = vaultDecrypt(verifier, key); } catch { return res.status(401).json({ error: 'Invalid master vault passphrase' }); }
      if (check !== VAULT_SENTINEL) return res.status(401).json({ error: 'Invalid master vault passphrase' });
    } else {
      // First-time unlock: auto-create verifier
      const blob = vaultEncrypt(VAULT_SENTINEL, key);
      db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_verifier', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(blob);
      db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_last_rotated', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(new Date().toISOString());
    }
    vaultKeys.set(token, key);
    res.json(true);
  } catch (err: any) {
    logServerError('/api/secrets/unlock', err, req);
    auditServerError('secrets/unlock', err, session.user.id);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/secrets/lock', authMiddleware, (req: Request, res: Response) => {
  const token = (req as any).sessionToken;
  vaultKeys.set(token, null);
  res.json(true);
});

app.post('/api/secrets/change-passphrase', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  const token = (req as any).sessionToken;
  if (session.user.role !== 'ProductOwner' && session.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Only Product Owners can change the vault passphrase' });
  }
  const { currentPassphrase, newPassphrase } = req.body;
  if (!newPassphrase || newPassphrase.trim().length < 6) return res.status(400).json({ error: 'New passphrase must be at least 6 characters' });
  try {
    const salt = getOrCreateVaultSalt();
    const oldKey = await new Promise<Buffer>((res, rej) => crypto.pbkdf2((currentPassphrase || '').trim(), salt, VAULT_ITERATIONS, VAULT_KEY_LEN, 'sha256', (e, k) => e ? rej(e) : res(k)));
    const verifier = getVaultVerifier();
    if (verifier) {
      let check: string;
      try { check = vaultDecrypt(verifier, oldKey); } catch { return res.status(401).json({ error: 'Current passphrase is incorrect' }); }
      if (check !== VAULT_SENTINEL) return res.status(401).json({ error: 'Current passphrase is incorrect' });
    }
    const localRows = db.prepare("SELECT id, encrypted_value FROM secrets_meta WHERE encrypted_value IS NOT NULL AND encrypted_value != ''").all() as any[];
    const decrypted: { id: string; plain: string }[] = [];
    for (const r of localRows) {
      try { decrypted.push({ id: r.id, plain: vaultDecrypt(r.encrypted_value, oldKey) }); }
      catch (e: any) { return res.status(500).json({ error: `Could not re-encrypt secret ${r.id}: ${e.message}` }); }
    }
    const newSalt = crypto.randomBytes(32).toString('hex');
    const newKey = await new Promise<Buffer>((res, rej) => crypto.pbkdf2(newPassphrase.trim(), newSalt, VAULT_ITERATIONS, VAULT_KEY_LEN, 'sha256', (e, k) => e ? rej(e) : res(k)));
    const updateStmt = db.prepare("UPDATE secrets_meta SET encrypted_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    db.transaction(() => {
      for (const item of decrypted) updateStmt.run(vaultEncrypt(item.plain, newKey), item.id);
      db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_salt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(newSalt);
      db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_verifier', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(vaultEncrypt(VAULT_SENTINEL, newKey));
      db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_last_rotated', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(new Date().toISOString());
    })();
    vaultKeys.set(token, newKey);
    logSecretAudit(session.user.id, 'VaultPassphraseRotated', 'MasterVault');
    res.json(true);
  } catch (err: any) {
    logServerError('/api/secrets/change-passphrase', err, req);
    auditServerError('secrets/change-passphrase', err, session.user.id);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/secrets/list', authMiddleware, (req: Request, res: Response) => {
  try {
    // Ensure secrets_meta has encrypted_value column (may be missing on older DBs)
    try { db.exec('ALTER TABLE secrets_meta ADD COLUMN encrypted_value TEXT'); } catch (_) {}
    const local = db.prepare(
      `SELECT id, name, category, description, last_rotated_at as lastRotatedAt, last_accessed_at as lastAccessedAt, last_accessed_by as lastAccessedBy, created_at as createdAt, updated_at as updatedAt, 'local' as source FROM secrets_meta ORDER BY name`
    ).all();
    res.json(local);
  } catch (err: any) {
    logServerError('/api/secrets/list', err, req);
    auditServerError('secrets/list', err, (req as any).userSession?.user?.id);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/secrets/add', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  const token = (req as any).sessionToken;
  const key = vaultKeys.get(token);
  if (!key) return res.status(403).json({ error: 'Vault is locked. Unlock with your passphrase first.' });
  const { name, category, value, description } = req.body;
  if (!name || !value) return res.status(400).json({ error: 'Name and value are required' });
  try {
    const id = crypto.randomUUID();
    const encrypted = vaultEncrypt(value, key);
    db.prepare(
      `INSERT INTO secrets_meta (id, name, category, description, last_rotated_at, encrypted_value, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run(id, name, category || 'General', description || '', encrypted);
    logSecretAudit(session.user.id, 'SecretAdd', id);
    res.json(true);
  } catch (err: any) {
    logServerError('/api/secrets/add', err, req);
    auditServerError('secrets/add', err, session.user.id);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/secrets/reveal/:id', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  const token = (req as any).sessionToken;
  const key = vaultKeys.get(token);
  if (!key) return res.status(403).json({ error: 'Vault is locked' });
  try {
    const meta = db.prepare('SELECT * FROM secrets_meta WHERE id = ?').get(req.params.id) as any;
    if (!meta) return res.status(404).json({ error: 'Secret not found' });
    if (!meta.encrypted_value) return res.status(500).json({ error: 'No encrypted data found for this secret' });
    const plaintext = vaultDecrypt(meta.encrypted_value, key);
    db.prepare('UPDATE secrets_meta SET last_accessed_at = CURRENT_TIMESTAMP, last_accessed_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(session.user.id, req.params.id);
    logSecretAudit(session.user.id, 'SecretView', req.params.id);
    res.json(plaintext);
  } catch (err: any) {
    logServerError('/api/secrets/reveal', err, req);
    auditServerError('secrets/reveal', err, session.user.id);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/secrets/rotate/:id', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  const token = (req as any).sessionToken;
  const key = vaultKeys.get(token);
  if (!key) return res.status(403).json({ error: 'Vault is locked' });
  try {
    const meta = db.prepare('SELECT id FROM secrets_meta WHERE id = ?').get(req.params.id) as any;
    if (!meta) return res.status(404).json({ error: 'Secret not found' });
    const { newValue } = req.body;
    if (!newValue) return res.status(400).json({ error: 'newValue is required' });
    const encrypted = vaultEncrypt(newValue, key);
    db.prepare('UPDATE secrets_meta SET encrypted_value = ?, last_rotated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(encrypted, req.params.id);
    logSecretAudit(session.user.id, 'SecretRotate', req.params.id);
    res.json(true);
  } catch (err: any) {
    logServerError('/api/secrets/rotate', err, req);
    auditServerError('secrets/rotate', err, session.user.id);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/secrets/:id', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  try {
    const meta = db.prepare('SELECT id FROM secrets_meta WHERE id = ?').get(req.params.id) as any;
    if (!meta) return res.status(404).json({ error: 'Secret not found' });
    db.prepare('DELETE FROM secrets_meta WHERE id = ?').run(req.params.id);
    logSecretAudit(session.user.id, 'SecretDelete', req.params.id);
    res.json(true);
  } catch (err: any) {
    logServerError('/api/secrets/delete', err, req);
    auditServerError('secrets/delete', err, session.user.id);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/secrets/azure/status', authMiddleware, (req: Request, res: Response) => {
  try {
    const row = db.prepare("SELECT status, connected_as, error FROM plugin_configs WHERE plugin_id = 'azure-keyvault'").get() as any;
    res.json({ connected: row?.status === 'connected', status: row?.status || 'disconnected', connectedAs: row?.connected_as || null, error: row?.error || null });
  } catch { res.json({ connected: false, status: 'disconnected', connectedAs: null, error: null }); }
});

app.get('/api/secrets/azure/list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const akv = pluginHost.getAzureKeyVaultConnector?.();
    if (!akv) return res.json([]);
    const list = await akv.listSecrets();
    res.json(list || []);
  } catch (err: any) {
    logServerError('/api/secrets/azure/list', err, req);
    res.json([]); // non-fatal: return empty instead of error
  }
});

app.get('/api/secrets/azure/reveal/:name', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  try {
    const akv = pluginHost.getAzureKeyVaultConnector?.();
    if (!akv) return res.status(503).json({ error: 'Azure Key Vault is not connected' });
    const plain = await akv.getSecretValue(req.params.name);
    logSecretAudit(session.user.id, 'SecretView', `azure:${req.params.name}`);
    res.json(plain);
  } catch (err: any) {
    logServerError('/api/secrets/azure/reveal', err, req);
    auditServerError('secrets/azure/reveal', err, session.user.id);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/secrets/azure/add', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  try {
    const akv = pluginHost.getAzureKeyVaultConnector?.();
    if (!akv) return res.status(503).json({ error: 'Azure Key Vault is not connected' });
    const { name, value, category } = req.body;
    await akv.setSecret(name, value, category);
    logSecretAudit(session.user.id, 'SecretAdd', `azure:${name}`);
    res.json(true);
  } catch (err: any) {
    logServerError('/api/secrets/azure/add', err, req);
    auditServerError('secrets/azure/add', err, session.user.id);
    res.status(500).json({ error: err.message });
  }
});
// ── 5a. Sync Endpoints ───────────────────────────────────────
app.get('/api/sync/state', (req: Request, res: Response) => {
  try {
    let pending = 0;
    try {
      const pendingRow = db.prepare('SELECT COUNT(*) as cnt FROM local_mutations WHERE synced = 0').get() as any;
      pending = pendingRow?.cnt || 0;
    } catch {}

    let lastSyncAt: string | undefined = undefined;
    try {
      const syncRow = db.prepare('SELECT MIN(last_sync_at) as t FROM sync_state').get() as any;
      lastSyncAt = syncRow?.t || undefined;
    } catch {}

    const provider = pluginHost.getActiveProvider();

    res.json({
      status: provider ? 'idle' : 'idle',
      lastSyncAt: lastSyncAt || new Date().toISOString(),
      pendingChanges: pending
    });
  } catch (err: any) {
    res.json({
      status: 'idle',
      lastSyncAt: new Date().toISOString(),
      pendingChanges: 0
    });
  }
});

app.post('/api/sync/trigger', async (req: Request, res: Response) => {
  try {
    const provider = pluginHost.getActiveProvider();
    if (provider) {
      await provider.pushMutations(db);
      await provider.pullDeltas(db);
    }
    const now = new Date().toISOString();
    res.json({ success: true, status: 'idle', lastSyncAt: now, pendingChanges: 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── 5b. System Health Endpoint ──────────────────────────────
app.get('/api/health', (req: Request, res: Response) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({
      status: 'healthy',
      app: 'Horizon PM',
      version: '1.1.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        engine: 'sqlite'
      }
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// ── 6. Static Asset Serving for Hosted Web Mode ──────────────
const clientDistCandidates = [
  path.join(process.cwd(), 'out', 'renderer'),
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'public')
];
const clientDist = clientDistCandidates.find(p => fs.existsSync(p)) || path.join(process.cwd(), 'public');

app.use(express.static(clientDist));
app.use('/templates', express.static(path.join(process.cwd(), 'public', 'templates')));

// SPA Fallback for client-side routing
app.use((req: Request, res: Response) => {
  const indexHtml = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.send(`
      <html>
        <head><title>Horizon PM Server</title></head>
        <body style="font-family:sans-serif;background:#070B19;color:#fff;text-align:center;padding:50px;">
          <h2 style="color:#2E5EFF;">Horizon PM API Server Active</h2>
          <p>Database: <code>${dbPath}</code></p>
          <p>Please build the frontend (<code>npm run build</code>) to serve the hosted web client.</p>
        </body>
      </html>
    `);
  }
});

// ── Global Express Error Handler ────────────────────────────
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const session = (req as any).userSession;
  logServerError('ExpressGlobalError', err, req);
  auditServerError(`${req.method} ${req.path}`, err, session?.user?.id);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});
const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` 🚀 Horizon PM Hosted Web Server running on port ${PORT}`);
  console.log(` 📦 Database: SQLite active`);
  console.log(` 🌐 Serving Web Client from: ${clientDist}`);
  console.log(`=======================================================`);
});

const handleGracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    try {
      db.close();
      console.log('SQLite database connection closed successfully.');
    } catch (e) {
      console.error('Error during database close:', e);
    }
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Graceful shutdown timed out after 10s, forcing exit.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
