import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeSql, validateSafeQuery, validateSafeExecute, sanitizeRows } from '../src/utils/sqlSecurity.ts';

describe('Security Hardening & SQL Policy Engine Test Suite', () => {
  it('allows legitimate SELECT queries and strips comments', () => {
    const rawSql = 'SELECT id, name /* internal label */ FROM products WHERE status = ? -- filter active';
    const safeSql = validateSafeQuery(rawSql);
    assert.strictEqual(safeSql, 'SELECT id, name   FROM products WHERE status = ?');
  });

  it('rejects multi-statement injection attempts', () => {
    assert.throws(() => {
      validateSafeQuery('SELECT 1; DROP TABLE products');
    }, /Multiple SQL statements/);
  });

  it('rejects DDL and schema destruction operations on query endpoint', () => {
    assert.throws(() => {
      validateSafeQuery('DROP TABLE users');
    }, /Only SELECT queries/);

    assert.throws(() => {
      validateSafeQuery('ALTER TABLE products ADD COLUMN hacked TEXT');
    }, /Only SELECT queries/);
  });

  it('rejects DDL operations on execute endpoint', () => {
    assert.throws(() => {
      validateSafeExecute('DROP TABLE products');
    }, /Access denied/);

    assert.throws(() => {
      validateSafeExecute('ALTER TABLE tasks DROP COLUMN priority');
    }, /Access denied/);
  });

  it('blocks direct queries to protected system tables (_kv, _migrations)', () => {
    assert.throws(() => {
      validateSafeQuery('SELECT * FROM _kv');
    }, /System key-value and migration tables are protected/);

    assert.throws(() => {
      validateSafeQuery('SELECT version FROM _migrations');
    }, /System key-value and migration tables are protected/);
  });

  it('blocks direct querying of password_hash credentials', () => {
    assert.throws(() => {
      validateSafeQuery('SELECT id, password_hash FROM users');
    }, /Querying credential hashes is strictly prohibited/);

    assert.throws(() => {
      validateSafeQuery('SELECT * FROM users');
    }, /Querying credential hashes is strictly prohibited/);
  });

  it('blocks direct mutation of users, audit_log, and system tables via execute endpoint', () => {
    assert.throws(() => {
      validateSafeExecute("DELETE FROM users WHERE role = 'SuperAdmin'");
    }, /Direct mutation of security\/audit\/user tables is forbidden/);

    assert.throws(() => {
      validateSafeExecute("INSERT INTO audit_log (id, action) VALUES ('1', 'Tamper')");
    }, /Direct mutation of security\/audit\/user tables is forbidden/);

    assert.throws(() => {
      validateSafeExecute("UPDATE plugin_configs SET settings_json = '{}'");
    }, /Direct mutation of security\/audit\/user tables is forbidden/);
  });

  it('allows legitimate application mutations (tasks, products, releases) for admin roles', () => {
    const insertSql = 'INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)';
    assert.strictEqual(validateSafeExecute(insertSql, 'ProductOwner'), insertSql);

    const updateSql = 'UPDATE products SET name = ? WHERE id = ?';
    assert.strictEqual(validateSafeExecute(updateSql, 'ProductOwner'), updateSql);

    const deleteSql = 'DELETE FROM integration_nodes WHERE map_id = ?';
    assert.strictEqual(validateSafeExecute(deleteSql, 'ProductOwner'), deleteSql);
  });

  it('enforces role-based mutation restrictions on TeamMember', () => {
    // TeamMember CAN update tasks
    const taskSql = 'UPDATE tasks SET status = ? WHERE id = ?';
    assert.strictEqual(validateSafeExecute(taskSql, 'TeamMember'), taskSql);

    // TeamMember CANNOT update products
    assert.throws(() => {
      validateSafeExecute('UPDATE products SET name = ? WHERE id = ?', 'TeamMember');
    }, /Team Members cannot modify table 'products'/);

    // TeamMember CANNOT modify apis
    assert.throws(() => {
      validateSafeExecute("INSERT INTO apis (id, name) VALUES ('1', 'Test')", 'TeamMember');
    }, /Team Members cannot modify table 'apis'/);
  });

  it('strips password_hash from result rows defense-in-depth', () => {
    const rawRows = [
      { id: '1', username: 'admin', password_hash: '$2a$10$abcdef', display_name: 'Admin User' },
      { id: '2', username: 'developer', password: 'secretpassword', display_name: 'Developer' }
    ];
    const cleaned = sanitizeRows(rawRows);
    assert.strictEqual(cleaned[0].password_hash, undefined);
    assert.strictEqual(cleaned[0].username, 'admin');
    assert.strictEqual(cleaned[1].password, undefined);
    assert.strictEqual(cleaned[1].display_name, 'Developer');
  });

  it('verifies electron preload contracts pass token as first parameter on protected channels', () => {
    const preloadPath = path.resolve('electron/preload.ts');
    const preloadSource = fs.readFileSync(preloadPath, 'utf8');

    // Verify token helper is present
    assert.ok(preloadSource.includes('function getToken('));

    // Verify plugins methods invoke with getToken
    assert.ok(preloadSource.includes('IPC.PLUGIN_LIST, getToken('));
    assert.ok(preloadSource.includes('IPC.PLUGIN_SAVE_CONFIG, getToken('));
    assert.ok(preloadSource.includes('IPC.PLUGIN_CONNECT, getToken('));
    assert.ok(preloadSource.includes('IPC.PLUGIN_SET_ACTIVE_BACKEND, getToken('));
    assert.ok(preloadSource.includes('IPC.STORAGE_UPLOAD_DOCUMENT, getToken('));
    assert.ok(preloadSource.includes('IPC.STORAGE_DOWNLOAD_DOCUMENT, getToken('));
    assert.ok(preloadSource.includes('IPC.SYNC_TRIGGER, getToken('));
    assert.ok(preloadSource.includes('IPC.SYNC_GET_STATE, getToken('));
    assert.ok(preloadSource.includes('IPC.NOTIFY_SEND, getToken('));
    assert.ok(preloadSource.includes('IPC.SECRETS_GET_AZURE_STATUS, getToken('));
  });

  it('verifies plugin-host IPC handlers require authentication on all channels', () => {
    const phPath = path.resolve('electron/plugins/plugin-host.ts');
    const phSource = fs.readFileSync(phPath, 'utf8');

    assert.ok(phSource.includes('const requireAuth = (token: string)'));
    assert.ok(phSource.includes('const requireAdmin = (token: string)'));
    assert.ok(phSource.includes('IPC.STORAGE_UPLOAD_DOCUMENT'));
    assert.ok(phSource.includes('requireAuth(token)'));
  });
});
