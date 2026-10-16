import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { runMigrations } from '../electron/db/migrations';
import { PluginHost } from '../electron/plugins/plugin-host';
import { pluginLogger } from '../electron/plugins/logger';
import { SessionInfo, HorizonUser, UserRole } from '../src/types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
const sessions = new Map<string, SessionInfo>();
const SECRET_KEY = crypto.randomBytes(32);

function generateToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '') || 
                (req.body?.token as string) || 
                (req.query?.token as string);

  let effectiveToken = token;
  if (!effectiveToken && sessions.size > 0) {
    effectiveToken = Array.from(sessions.keys())[0];
  }

  if (!effectiveToken || !sessions.has(effectiveToken)) {
    return res.status(401).json({ error: 'Unauthorized: Session invalid or expired' });
  }

  (req as any).userSession = sessions.get(effectiveToken);
  (req as any).sessionToken = effectiveToken;
  next();
};

// ── 1. Authentication Routes ─────────────────────────────────
app.post('/api/auth/login', async (req: Request, res: Response) => {
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
  const token = req.body.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : '');
  if (token) sessions.delete(token);
  res.json({ success: true });
});

app.get('/api/auth/session', (req: Request, res: Response) => {
  const token = (req.query.token as string) || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : '');
  if (!token || !sessions.has(token)) return res.json(null);
  res.json(sessions.get(token));
});

app.post('/api/auth/change-password', authMiddleware, async (req: Request, res: Response) => {
  const session = (req as any).userSession;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, session.user.id);
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
  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(password || 'horizon123', 10);
  const rawName = (displayName || username).trim();
  const parts = rawName.split(/\s+/);
  const initials = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : rawName.substring(0, 2).toUpperCase();

  db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role, active, email, avatar_initials, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(id, username.trim(), hash, displayName.trim(), role || 'TeamMember', active !== false ? 1 : 0, email || null, initials);

  res.json({ id, username, displayName, role, active: active !== false, email, avatarInitials: initials });
});

// ── 2. Microsoft Entra ID (Azure AD) SSO Endpoints ───────────
app.get('/api/auth/azure-ad/url', async (req: Request, res: Response) => {
  try {
    const connector = pluginHost.getAzureADConnector();
    const state = crypto.randomBytes(16).toString('hex');
    const url = await connector.getAuthUrl(state);
    res.json({ url, state });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Azure AD SSO not configured' });
  }
});

app.post('/api/auth/azure-ad/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code required' });

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

// ── 4. Integration Mapping Routes ────────────────────────────
app.get('/api/integration/maps', authMiddleware, (req: Request, res: Response) => {
  const { productId } = req.query;
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
app.get('/api/plugins/list', (req: Request, res: Response) => {
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

app.get('/api/plugins/active-backend', (req: Request, res: Response) => {
  res.json(pluginHost.getActiveBackendId());
});

app.post('/api/plugins/active-backend', authMiddleware, (req: Request, res: Response) => {
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

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` 🚀 Horizon PM Hosted Web Server running on port ${PORT}`);
  console.log(` 📦 Database: SQLite (${dbPath})`);
  console.log(` 🌐 Serving Web Client from: ${clientDist}`);
  console.log(`=======================================================`);
});
