import Database from 'better-sqlite3';
import { TABLES } from './schema';

export function runMigrations(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY,
    version INTEGER NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const row = db.prepare('SELECT MAX(version) as version FROM _migrations').get() as { version: number | null };
  const currentVersion = row?.version || 0;

  // Version 1: Base table definitions
  if (currentVersion < 1) {
    for (const tableSql of TABLES) {
      try {
        db.exec(tableSql);
      } catch (e) {
        console.error('Error applying base schema:', e);
      }
    }
    db.prepare('INSERT INTO _migrations (version) VALUES (1)').run();
  }

  // Version 2: Safe additive domain extensions
  if (currentVersion < 2) {
    const additiveCols = [
      'ALTER TABLE products ADD COLUMN icon TEXT',
      `CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      'ALTER TABLE interfaces ADD COLUMN service_provider TEXT',
      'ALTER TABLE interfaces ADD COLUMN target_audience TEXT',
      "ALTER TABLE interfaces ADD COLUMN direction TEXT DEFAULT 'Provided'",
      'ALTER TABLE interfaces ADD COLUMN connection_details TEXT',
      'ALTER TABLE documents_meta ADD COLUMN file_name TEXT',
      'ALTER TABLE documents_meta ADD COLUMN file_data TEXT',
      "ALTER TABLE documents_meta ADD COLUMN sharepoint_status TEXT DEFAULT 'Pending'",
      'ALTER TABLE documents_meta ADD COLUMN linked_entity_type TEXT',
      'ALTER TABLE documents_meta ADD COLUMN linked_entity_id TEXT',
      'ALTER TABLE documents_meta ADD COLUMN linked_entity_name TEXT',
      'ALTER TABLE schedule_events ADD COLUMN duration_days INTEGER DEFAULT 1',
      'ALTER TABLE schedule_events ADD COLUMN notify_days_before INTEGER DEFAULT 1',
      'ALTER TABLE hr_records ADD COLUMN phone TEXT',
      'ALTER TABLE hr_records ADD COLUMN work_location TEXT',
      'ALTER TABLE hr_records ADD COLUMN notes TEXT',
      'ALTER TABLE uat_cases ADD COLUMN attachment_name TEXT',
      'ALTER TABLE uat_cases ADD COLUMN attachment_data TEXT',
      'ALTER TABLE uat_cases ADD COLUMN attachment_size INTEGER',
      'ALTER TABLE apis ADD COLUMN given_to TEXT',
      'ALTER TABLE apis ADD COLUMN auth_mechanism TEXT',
      'ALTER TABLE apis ADD COLUMN is_mocked INTEGER DEFAULT 0',
      "ALTER TABLE apis ADD COLUMN status TEXT DEFAULT 'Active'",
      'ALTER TABLE secrets_meta ADD COLUMN encrypted_value TEXT'
    ];

    for (const stmt of additiveCols) {
      try { db.exec(stmt); } catch (_) {}
    }
    db.prepare('INSERT INTO _migrations (version) VALUES (2)').run();
  }

  // Version 3: Integration Mapping Tables
  if (currentVersion < 3) {
    const integrationTables = [
      `CREATE TABLE IF NOT EXISTS integration_maps (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        imported_at TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS integration_nodes (
        id TEXT PRIMARY KEY,
        map_id TEXT NOT NULL,
        node_key TEXT NOT NULL,
        label TEXT NOT NULL,
        node_type TEXT NOT NULL,
        team_owner TEXT,
        tech_stack TEXT,
        environment TEXT,
        criticality TEXT,
        notes TEXT,
        pos_x REAL DEFAULT 0,
        pos_y REAL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS integration_edges (
        id TEXT PRIMARY KEY,
        map_id TEXT NOT NULL,
        edge_key TEXT NOT NULL,
        from_node TEXT NOT NULL,
        to_node TEXT NOT NULL,
        protocol TEXT,
        direction TEXT,
        data_format TEXT,
        frequency TEXT,
        criticality TEXT,
        status TEXT,
        notes TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS integration_groups (
        id TEXT PRIMARY KEY,
        map_id TEXT NOT NULL,
        group_key TEXT NOT NULL,
        label TEXT NOT NULL,
        node_keys TEXT,
        color TEXT
      )`
    ];

    for (const tbl of integrationTables) {
      try { db.exec(tbl); } catch (_) {}
    }
    db.prepare('INSERT INTO _migrations (version) VALUES (3)').run();
  }
}
