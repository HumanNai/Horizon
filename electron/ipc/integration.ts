import { IpcMain } from 'electron';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { IPC } from '../../src/types';
import { sessions } from './auth';

export function registerIntegrationHandlers(ipcMain: IpcMain, db: Database.Database) {
  // Helper to validate session
  const validateSession = (token: string) => {
    let effectiveToken = token;
    if (!effectiveToken && sessions.size > 0) {
      effectiveToken = Array.from(sessions.keys())[0];
    }
    if (!effectiveToken || !sessions.has(effectiveToken)) {
      throw new Error('Unauthorized');
    }
    return sessions.get(effectiveToken)!;
  };

  // 1. List maps for a product
  ipcMain.handle(IPC.INTEGRATION_LIST_MAPS, (event, token: string, productId: string) => {
    validateSession(token);
    const rows = db.prepare(`
      SELECT id, product_id as productId, name, description, imported_at as importedAt, created_by as createdBy, created_at as createdAt
      FROM integration_maps
      WHERE product_id = ?
      ORDER BY created_at DESC
    `).all(productId);
    return rows;
  });

  // 2. Create map
  ipcMain.handle(IPC.INTEGRATION_CREATE_MAP, (event, token: string, data: { productId: string; name: string; description?: string }) => {
    const session = validateSession(token);
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO integration_maps (id, product_id, name, description, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, data.productId, data.name, data.description || '', session.user.displayName || session.user.username);
    return { id, productId: data.productId, name: data.name, description: data.description };
  });

  // 3. Delete map & cascaded data
  ipcMain.handle(IPC.INTEGRATION_DELETE_MAP, (event, token: string, mapId: string) => {
    validateSession(token);
    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM integration_nodes WHERE map_id = ?').run(mapId);
      db.prepare('DELETE FROM integration_edges WHERE map_id = ?').run(mapId);
      db.prepare('DELETE FROM integration_groups WHERE map_id = ?').run(mapId);
      db.prepare('DELETE FROM integration_maps WHERE id = ?').run(mapId);
    });
    deleteTx();
    return true;
  });

  // 4. Get full map data (nodes, edges, groups)
  ipcMain.handle(IPC.INTEGRATION_GET_MAP_DATA, (event, token: string, mapId: string) => {
    validateSession(token);
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

    return { map, nodes, edges, groups: parsedGroups };
  });

  // 5. Import Excel parsed data
  ipcMain.handle(IPC.INTEGRATION_IMPORT_EXCEL, (event, token: string, payload: {
    mapId: string;
    nodes: any[];
    edges: any[];
    groups?: any[];
  }) => {
    validateSession(token);
    const { mapId, nodes, edges, groups = [] } = payload;

    const importTx = db.transaction(() => {
      // Clear existing for this map if re-importing
      db.prepare('DELETE FROM integration_nodes WHERE map_id = ?').run(mapId);
      db.prepare('DELETE FROM integration_edges WHERE map_id = ?').run(mapId);
      db.prepare('DELETE FROM integration_groups WHERE map_id = ?').run(mapId);

      // Insert nodes
      const insertNode = db.prepare(`
        INSERT INTO integration_nodes (id, map_id, node_key, label, node_type, team_owner, tech_stack, environment, criticality, notes, pos_x, pos_y)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      nodes.forEach((n, idx) => {
        const id = crypto.randomUUID();
        // Compute initial layout grid coordinates if not provided
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

      // Insert edges
      const insertEdge = db.prepare(`
        INSERT INTO integration_edges (id, map_id, edge_key, from_node, to_node, protocol, direction, data_format, frequency, criticality, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      edges.forEach((e) => {
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

      // Insert groups
      const insertGroup = db.prepare(`
        INSERT INTO integration_groups (id, map_id, group_key, label, node_keys, color)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      groups.forEach((g) => {
        const id = crypto.randomUUID();
        let nodeKeysJson = '[]';
        if (Array.isArray(g.node_ids || g.nodeKeys)) {
          nodeKeysJson = JSON.stringify(g.node_ids || g.nodeKeys);
        } else if (typeof (g.node_ids || g.nodeKeys) === 'string') {
          nodeKeysJson = JSON.stringify((g.node_ids || g.nodeKeys).split(',').map((s: string) => s.trim()));
        }

        insertGroup.run(
          id,
          mapId,
          String(g.group_id || g.groupKey || id),
          String(g.group_label || g.label || 'Domain'),
          nodeKeysJson,
          g.color || '#2E5EFF'
        );
      });

      // Update map imported_at timestamp
      db.prepare(`UPDATE integration_maps SET imported_at = CURRENT_TIMESTAMP WHERE id = ?`).run(mapId);
    });

    importTx();
    return true;
  });

  // 6. Save node positions after drag & drop
  ipcMain.handle(IPC.INTEGRATION_SAVE_POSITIONS, (event, token: string, positions: Array<{ id?: string; nodeKey?: string; posX: number; posY: number; mapId: string }>) => {
    validateSession(token);
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
    return true;
  });
}
