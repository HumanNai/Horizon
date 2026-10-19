import Database from 'better-sqlite3';
import { TABLES } from './schema';

export function runMigrations(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY,
    version INTEGER NOT NULL UNIQUE,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const row = db.prepare('SELECT MAX(version) as version FROM _migrations').get() as { version: number | null };
  const currentVersion = row?.version || 0;

  const columnExists = (tableName: string, columnName: string): boolean => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
      return cols.some(c => c.name.toLowerCase() === columnName.toLowerCase());
    } catch {
      return false;
    }
  };

  // Version 1: Base table definitions (Transactional)
  if (currentVersion < 1) {
    const v1Tx = db.transaction(() => {
      for (const tableSql of TABLES) {
        db.exec(tableSql);
      }
      db.prepare('INSERT INTO _migrations (version) VALUES (1)').run();
    });
    v1Tx();
  }

  // Version 2: Additive domain extensions (Transactional)
  if (currentVersion < 2) {
    const v2Tx = db.transaction(() => {
      if (!columnExists('products', 'icon')) db.exec('ALTER TABLE products ADD COLUMN icon TEXT');
      db.exec(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      if (!columnExists('interfaces', 'service_provider')) db.exec('ALTER TABLE interfaces ADD COLUMN service_provider TEXT');
      if (!columnExists('interfaces', 'target_audience')) db.exec('ALTER TABLE interfaces ADD COLUMN target_audience TEXT');
      if (!columnExists('interfaces', 'direction')) db.exec("ALTER TABLE interfaces ADD COLUMN direction TEXT DEFAULT 'Provided'");
      if (!columnExists('interfaces', 'connection_details')) db.exec('ALTER TABLE interfaces ADD COLUMN connection_details TEXT');
      if (!columnExists('documents_meta', 'file_name')) db.exec('ALTER TABLE documents_meta ADD COLUMN file_name TEXT');
      if (!columnExists('documents_meta', 'file_data')) db.exec('ALTER TABLE documents_meta ADD COLUMN file_data TEXT');
      if (!columnExists('documents_meta', 'sharepoint_status')) db.exec("ALTER TABLE documents_meta ADD COLUMN sharepoint_status TEXT DEFAULT 'Pending'");
      if (!columnExists('documents_meta', 'linked_entity_type')) db.exec('ALTER TABLE documents_meta ADD COLUMN linked_entity_type TEXT');
      if (!columnExists('documents_meta', 'linked_entity_id')) db.exec('ALTER TABLE documents_meta ADD COLUMN linked_entity_id TEXT');
      if (!columnExists('documents_meta', 'linked_entity_name')) db.exec('ALTER TABLE documents_meta ADD COLUMN linked_entity_name TEXT');
      if (!columnExists('schedule_events', 'duration_days')) db.exec('ALTER TABLE schedule_events ADD COLUMN duration_days INTEGER DEFAULT 1');
      if (!columnExists('schedule_events', 'notify_days_before')) db.exec('ALTER TABLE schedule_events ADD COLUMN notify_days_before INTEGER DEFAULT 1');
      if (!columnExists('hr_records', 'phone')) db.exec('ALTER TABLE hr_records ADD COLUMN phone TEXT');
      if (!columnExists('hr_records', 'work_location')) db.exec('ALTER TABLE hr_records ADD COLUMN work_location TEXT');
      if (!columnExists('hr_records', 'notes')) db.exec('ALTER TABLE hr_records ADD COLUMN notes TEXT');
      if (!columnExists('uat_cases', 'attachment_name')) db.exec('ALTER TABLE uat_cases ADD COLUMN attachment_name TEXT');
      if (!columnExists('uat_cases', 'attachment_data')) db.exec('ALTER TABLE uat_cases ADD COLUMN attachment_data TEXT');
      if (!columnExists('uat_cases', 'attachment_size')) db.exec('ALTER TABLE uat_cases ADD COLUMN attachment_size INTEGER');
      if (!columnExists('apis', 'given_to')) db.exec('ALTER TABLE apis ADD COLUMN given_to TEXT');
      if (!columnExists('apis', 'auth_mechanism')) db.exec('ALTER TABLE apis ADD COLUMN auth_mechanism TEXT');
      if (!columnExists('apis', 'is_mocked')) db.exec('ALTER TABLE apis ADD COLUMN is_mocked INTEGER DEFAULT 0');
      if (!columnExists('apis', 'status')) db.exec("ALTER TABLE apis ADD COLUMN status TEXT DEFAULT 'Active'");
      if (!columnExists('secrets_meta', 'encrypted_value')) db.exec('ALTER TABLE secrets_meta ADD COLUMN encrypted_value TEXT');
      db.prepare('INSERT INTO _migrations (version) VALUES (2)').run();
    });
    v2Tx();
  }

  // Version 3: Integration Mapping Tables (Transactional)
  if (currentVersion < 3) {
    const v3Tx = db.transaction(() => {
      db.exec(`CREATE TABLE IF NOT EXISTS integration_maps (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        imported_at TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      db.exec(`CREATE TABLE IF NOT EXISTS integration_nodes (
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
      )`);
      db.exec(`CREATE TABLE IF NOT EXISTS integration_edges (
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
      )`);
      db.exec(`CREATE TABLE IF NOT EXISTS integration_groups (
        id TEXT PRIMARY KEY,
        map_id TEXT NOT NULL,
        group_key TEXT NOT NULL,
        label TEXT NOT NULL,
        node_keys TEXT,
        color TEXT
      )`);
      db.prepare('INSERT INTO _migrations (version) VALUES (3)').run();
    });
    v3Tx();
  }
}
