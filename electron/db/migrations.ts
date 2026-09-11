import Database from 'better-sqlite3';
import { TABLES } from './schema';

export function runMigrations(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY,
    version INTEGER NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const row = db.prepare('SELECT MAX(version) as version FROM _migrations').get() as { version: number | null };
  const currentVersion = row.version || 0;

  for (const tableSql of TABLES) {
    try {
      db.exec(tableSql);
    } catch (e) {
      console.error('Error applying table schema:', e);
    }
  }

  // Safe additive migrations for existing databases
  try {
    db.exec('ALTER TABLE products ADD COLUMN icon TEXT');
  } catch {}

  try {
    db.exec(`CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch {}

  // Safe additive migrations for interfaces (service & event brokers)
  try {
    db.exec('ALTER TABLE interfaces ADD COLUMN service_provider TEXT');
  } catch {}
  try {
    db.exec('ALTER TABLE interfaces ADD COLUMN target_audience TEXT');
  } catch {}
  try {
    db.exec("ALTER TABLE interfaces ADD COLUMN direction TEXT DEFAULT 'Provided'");
  } catch {}
  try {
    db.exec('ALTER TABLE interfaces ADD COLUMN connection_details TEXT');
  } catch {}

  // Safe additive migrations for documents_meta file uploads & SharePoint status
  try {
    db.exec('ALTER TABLE documents_meta ADD COLUMN file_name TEXT');
  } catch {}
  try {
    db.exec('ALTER TABLE documents_meta ADD COLUMN file_data TEXT');
  } catch {}
  try {
    db.exec("ALTER TABLE documents_meta ADD COLUMN sharepoint_status TEXT DEFAULT 'Pending'");
  } catch {}
  try {
    db.exec('ALTER TABLE documents_meta ADD COLUMN linked_entity_type TEXT');
  } catch {}
  try {
    db.exec('ALTER TABLE documents_meta ADD COLUMN linked_entity_id TEXT');
  } catch {}
  try {
    db.exec('ALTER TABLE documents_meta ADD COLUMN linked_entity_name TEXT');
  } catch {}

  // Safe additive migrations for hr_records team availability, WFH, and contact info
  try {
    db.exec("ALTER TABLE hr_records ADD COLUMN work_location TEXT DEFAULT 'Office'");
  } catch {}
  try {
    db.exec('ALTER TABLE hr_records ADD COLUMN phone TEXT');
  } catch {}
  try {
    db.exec('ALTER TABLE hr_records ADD COLUMN emergency_contact TEXT');
  } catch {}
  try {
    db.exec('ALTER TABLE hr_records ADD COLUMN skills_tags TEXT');
  } catch {}

  // Safe creation of apis table
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS apis (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      method TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      auth_type TEXT NOT NULL,
      client_id TEXT,
      scope TEXT,
      api_key_meta TEXT,
      given_to TEXT NOT NULL,
      rate_limit TEXT,
      owner_id TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT,
      sp_item_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch {}

  // Safe additive migrations for uat_cases product_id & attachment columns
  try {
    db.exec('ALTER TABLE uat_cases ADD COLUMN product_id TEXT');
  } catch {}
  try {
    db.exec('ALTER TABLE uat_cases ADD COLUMN attachment_name TEXT');
  } catch {}
  try {
    db.exec('ALTER TABLE uat_cases ADD COLUMN attachment_data TEXT');
  } catch {}
  try {
    db.exec('ALTER TABLE uat_cases ADD COLUMN attachment_size INTEGER');
  } catch {}
  try {
    db.exec(`UPDATE uat_cases SET product_id = (SELECT product_id FROM releases WHERE releases.id = uat_cases.release_id) WHERE (product_id IS NULL OR product_id = '') AND release_id IN (SELECT id FROM releases)`);
  } catch {}
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_uat_product ON uat_cases(product_id)');
  } catch {}

  // Normalize legacy architecture types to Internal / External
  try {
    db.exec(`
      UPDATE products SET type = 'Internal' WHERE type IN ('JOC', 'JTA', 'DFE') OR type IS NULL OR type = '';
      UPDATE products SET type = 'External' WHERE type = 'DDR';
    `);
  } catch {}

  // Automated orphan cleanup: remove child records referencing deleted products
  try {
    const prodRow = db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number };
    if (prodRow.cnt === 0) {
      // If there are no products, clean all product-scoped entities
      db.exec(`
        DELETE FROM releases;
        DELETE FROM tasks;
        DELETE FROM uat_cases;
        DELETE FROM interfaces;
        DELETE FROM apis;
        DELETE FROM documents_meta;
        DELETE FROM schedule_events;
        DELETE FROM product_custom_sections;
      `);
    } else {
      // Remove any orphans that point to non-existent products
      db.exec(`
        DELETE FROM releases WHERE product_id NOT IN (SELECT id FROM products);
        DELETE FROM tasks WHERE product_id IS NOT NULL AND product_id != '' AND product_id NOT IN (SELECT id FROM products);
        DELETE FROM uat_cases WHERE release_id NOT IN (SELECT id FROM releases);
        DELETE FROM interfaces WHERE product_id NOT IN (SELECT id FROM products);
        DELETE FROM apis WHERE product_id NOT IN (SELECT id FROM products);
        DELETE FROM documents_meta WHERE product_id IS NOT NULL AND product_id != '' AND product_id NOT IN (SELECT id FROM products);
        DELETE FROM schedule_events WHERE linked_type = 'Product' AND linked_id NOT IN (SELECT id FROM products);
        DELETE FROM schedule_events WHERE linked_type = 'Release' AND linked_id NOT IN (SELECT id FROM releases);
        DELETE FROM product_custom_sections WHERE product_id NOT IN (SELECT id FROM products);
      `);
    }
  } catch (e) {
    console.warn('Orphan cleanup warning:', e);
  }
}
