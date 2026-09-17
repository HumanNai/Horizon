import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

describe('SQLite Database Schema & Structure Test Suite', () => {
  const schemaPath = path.join(process.cwd(), 'electron', 'db', 'schema.ts');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  test('schema file exists and exports TABLES array', () => {
    assert.ok(fs.existsSync(schemaPath), 'schema.ts should exist');
    assert.ok(schemaContent.includes('export const TABLES = ['), 'TABLES should be exported');
  });

  test('defines core enterprise product management tables', () => {
    const requiredTables = [
      'users',
      'products',
      'releases',
      'tasks',
      'uat_cases',
      'interfaces',
      'secrets_meta',
      'hr_records',
      'schedule_events',
      'documents_meta',
      'audit_log',
      'plugin_configs',
      'sync_state',
      'local_mutations',
      'app_settings'
    ];

    for (const table of requiredTables) {
      const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i');
      assert.ok(tableRegex.test(schemaContent), `Table definition for '${table}' must exist in schema.ts`);
    }
  });

  test('defines primary keys for data integrity on all core entities', () => {
    const primaryKeyCount = (schemaContent.match(/PRIMARY KEY/gi) || []).length;
    assert.ok(primaryKeyCount >= 15, `Expected at least 15 PRIMARY KEY declarations, found ${primaryKeyCount}`);
  });

  test('defines performance indices for foreign keys and queries', () => {
    const indices = [
      'idx_unotif_user',
      'idx_tasks_product',
      'idx_tasks_release',
      'idx_releases_product',
      'idx_uat_release',
      'idx_uat_product',
      'idx_interfaces_product',
      'idx_apis_product',
      'idx_docs_product'
    ];

    for (const idx of indices) {
      assert.ok(schemaContent.includes(idx), `Index '${idx}' must be defined in schema.ts`);
    }
  });
});
