/**
 * SQL Security & Policy Enforcement Module
 * Sanitizes input, blocks DDL, multi-statement injection, and protects credential/system tables.
 */

export function sanitizeSql(sql: string): string {
  if (!sql || typeof sql !== 'string') throw new Error('Invalid SQL: Empty query string.');
  let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  cleaned = cleaned.replace(/--.*$/gm, ' ');
  cleaned = cleaned.trim();
  const statements = cleaned.split(';').map(s => s.trim()).filter(Boolean);
  if (statements.length > 1) {
    throw new Error('Access denied: Multiple SQL statements in a single execution are prohibited.');
  }
  return statements[0] || '';
}

export function validateSafeQuery(sql: string): string {
  const cleaned = sanitizeSql(sql);

  if (!/^(select|with)\b/i.test(cleaned)) {
    throw new Error('Access denied: Only SELECT queries are permitted on this channel.');
  }

  if (/\b(drop|alter|truncate|attach|detach|pragma|vacuum|reindex)\b/i.test(cleaned)) {
    throw new Error('Access denied: DDL and administrative commands are strictly forbidden.');
  }

  if (/\b(_kv|_migrations)\b/i.test(cleaned)) {
    throw new Error('Access denied: System key-value and migration tables are protected.');
  }

  if (/\bpassword_hash\b/i.test(cleaned) || /\bselect\s+\*\s+from\s+users\b/i.test(cleaned)) {
    throw new Error('Access denied: Querying credential hashes is strictly prohibited.');
  }

  return cleaned;
}

export function validateSafeExecute(sql: string): string {
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

export function sanitizeRows(rows: any[]): any[] {
  if (!Array.isArray(rows)) return rows;
  for (const row of rows) {
    if (row && typeof row === 'object') {
      delete row.password_hash;
      delete row.password;
    }
  }
  return rows;
}
