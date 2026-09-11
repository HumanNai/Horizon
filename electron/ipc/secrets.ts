import { IpcMain } from 'electron';
import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import { IPC, SecretMeta } from '../../src/types';
import { sessions } from './auth';

let secretKey: Buffer | null = null;

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ITERATIONS = 210000;   // OWASP 2023 recommendation for PBKDF2-SHA256
const KEY_LENGTH = 32;

// ── Per-installation salt ─────────────────────────────────────
// Stored in a local config table so the same passphrase always
// derives the same key for this installation.
function getOrCreateSalt(db: Database.Database): string {
  const row = db.prepare("SELECT value FROM _kv WHERE key = 'vault_salt'").get() as any;
  if (row) return row.value;
  const salt = crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_salt', ?)").run(salt);
  return salt;
}

function ensureKVTable(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS _kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
}

// ── Crypto helpers ─────────────────────────────────────────────
function encrypt(text: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  // Format: iv(12) | tag(16) | ciphertext — all base64
  return Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]).toString('base64');
}

function decrypt(encryptedText: string, key: Buffer): string {
  const data = Buffer.from(encryptedText, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function logAudit(db: Database.Database, userId: string, action: string, entityId: string) {
  db.prepare(
    `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, created_at)
     VALUES (?, ?, ?, 'Secret', ?, CURRENT_TIMESTAMP)`
  ).run(crypto.randomUUID(), userId, action, entityId);
}

export function registerSecretsHandlers(
  ipcMain: IpcMain,
  db: Database.Database,
  pluginHostOrConnector: any
) {
  ensureKVTable(db);

  // Also store encrypted value locally (in secrets_meta.encrypted_value) so the
  // vault works even before SharePoint is configured or when offline.
  try {
    db.exec(`ALTER TABLE secrets_meta ADD COLUMN encrypted_value TEXT`);
  } catch (_) { /* column already exists */ }

  const getGraphConnector = () => {
    if (pluginHostOrConnector?.getSharePointConnector) {
      try {
        return pluginHostOrConnector.getSharePointConnector();
      } catch {
        return null;
      }
    }
    return pluginHostOrConnector;
  };

  const getAzureKeyVault = () => {
    if (pluginHostOrConnector?.getAzureKeyVaultConnector) {
      try {
        return pluginHostOrConnector.getAzureKeyVaultConnector();
      } catch {
        return null;
      }
    }
    return null;
  };

  const VAULT_SENTINEL = 'HORIZON_VAULT_ENCRYPTED_SENTINEL_V1';

  const getVaultVerifier = (): string | null => {
    try {
      const row = db.prepare("SELECT value FROM _kv WHERE key = 'vault_verifier'").get() as any;
      return row?.value || null;
    } catch {
      return null;
    }
  };

  const getVaultLastRotated = (): string | null => {
    try {
      const row = db.prepare("SELECT value FROM _kv WHERE key = 'vault_last_rotated'").get() as any;
      return row?.value || null;
    } catch {
      return null;
    }
  };

  ipcMain.handle(IPC.SECRETS_GET_STATUS, async (_event, token: string) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    const verifier = getVaultVerifier();
    return {
      isInitialized: Boolean(verifier),
      isUnlocked: Boolean(secretKey),
      lastRotatedAt: getVaultLastRotated()
    };
  });

  ipcMain.handle(IPC.SECRETS_SETUP_PASSPHRASE, async (_event, token: string, passphrase: string) => {
    const session = sessions.get(token);
    if (!session || session.user.role !== 'ProductOwner') {
      throw new Error('Unauthorized: Only Product Owners can set up the vault master passphrase');
    }
    const cleanPass = (passphrase || '').trim();
    if (!cleanPass || cleanPass.length < 6) {
      throw new Error('Master passphrase must be at least 6 characters long');
    }

    const existingVerifier = getVaultVerifier();
    if (existingVerifier) {
      throw new Error('Vault is already initialized. Use Change Passphrase to update your master key.');
    }

    // Generate fresh salt
    const salt = crypto.randomBytes(32).toString('hex');
    db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_salt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(salt);

    // Derive key via PBKDF2
    const key = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(cleanPass, salt, ITERATIONS, KEY_LENGTH, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });

    // Encrypt verification sentinel
    const verifierBlob = encrypt(VAULT_SENTINEL, key);
    db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_verifier', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(verifierBlob);
    db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_last_rotated', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(new Date().toISOString());

    secretKey = key;
    logAudit(db, session.user.id, 'VaultPassphraseInitialized', 'MasterVault');
    return true;
  });

  ipcMain.handle(IPC.SECRETS_CHANGE_PASSPHRASE, async (_event, token: string, currentPassphrase: string, newPassphrase: string) => {
    const session = sessions.get(token);
    if (!session || session.user.role !== 'ProductOwner') {
      throw new Error('Unauthorized: Only Product Owners can change the vault master passphrase');
    }
    const cleanCur = (currentPassphrase || '').trim();
    const cleanNew = (newPassphrase || '').trim();

    if (!cleanNew || cleanNew.length < 6) {
      throw new Error('New master passphrase must be at least 6 characters long');
    }

    const verifier = getVaultVerifier();
    const salt = getOrCreateSalt(db);

    // Derive old key and verify
    const oldKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(cleanCur, salt, ITERATIONS, KEY_LENGTH, 'sha256', (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });

    if (verifier) {
      try {
        const check = decrypt(verifier, oldKey);
        if (check !== VAULT_SENTINEL) {
          throw new Error('Current passphrase is incorrect');
        }
      } catch {
        throw new Error('Current passphrase is incorrect');
      }
    }

    // 1. Decrypt all existing local secrets with oldKey
    const localRows = db.prepare("SELECT id, encrypted_value FROM secrets_meta WHERE encrypted_value IS NOT NULL AND encrypted_value != ''").all() as any[];
    const decryptedSecrets: { id: string; plain: string }[] = [];
    for (const r of localRows) {
      try {
        const plain = decrypt(r.encrypted_value, oldKey);
        decryptedSecrets.push({ id: r.id, plain });
      } catch (e: any) {
        throw new Error(`Could not re-encrypt secret ${r.id}: ${e.message}`);
      }
    }

    // 2. Generate new salt and derive newKey
    const newSalt = crypto.randomBytes(32).toString('hex');
    const newKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(cleanNew, newSalt, ITERATIONS, KEY_LENGTH, 'sha256', (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });

    // 3. Re-encrypt all local secrets with newKey
    const updateStmt = db.prepare("UPDATE secrets_meta SET encrypted_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    db.transaction(() => {
      for (const item of decryptedSecrets) {
        const newEnc = encrypt(item.plain, newKey);
        updateStmt.run(newEnc, item.id);
      }
      const newVerifier = encrypt(VAULT_SENTINEL, newKey);
      db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_salt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(newSalt);
      db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_verifier', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(newVerifier);
      db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_last_rotated', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(new Date().toISOString());
    })();

    secretKey = newKey;
    logAudit(db, session.user.id, 'VaultPassphraseRotated', 'MasterVault');
    return true;
  });

  ipcMain.handle(IPC.SECRETS_UNLOCK, async (_event, token: string, passphrase: string) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    const cleanPass = (passphrase || '').trim();
    if (!cleanPass) throw new Error('Passphrase is required');

    const verifier = getVaultVerifier();
    const salt = getOrCreateSalt(db);
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.pbkdf2(cleanPass, salt, ITERATIONS, KEY_LENGTH, 'sha256', (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });

    if (verifier) {
      try {
        const check = decrypt(verifier, derivedKey);
        if (check !== VAULT_SENTINEL) {
          throw new Error('Invalid master vault passphrase');
        }
      } catch {
        throw new Error('Invalid master vault passphrase');
      }
    } else {
      // First-time fallback / legacy auto-verifier setup
      const verifierBlob = encrypt(VAULT_SENTINEL, derivedKey);
      db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_verifier', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(verifierBlob);
      db.prepare("INSERT INTO _kv (key, value) VALUES ('vault_last_rotated', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(new Date().toISOString());
    }

    secretKey = derivedKey;
    return true;
  });

  ipcMain.handle(IPC.SECRETS_LOCK, (_event, token: string) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    secretKey = null;
    return true;
  });

  ipcMain.handle(IPC.SECRETS_LIST, async (_event, token: string) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    const local = db.prepare(
      `SELECT id, name, category, description, last_rotated_at, last_accessed_at, last_accessed_by, sp_item_id, created_at, updated_at, 'local' as source
       FROM secrets_meta ORDER BY name`
    ).all() as SecretMeta[];

    // If Azure Key Vault is connected, also query and append AKV secrets
    try {
      const akvRow = db.prepare("SELECT status FROM plugin_configs WHERE plugin_id = 'azure-keyvault'").get() as any;
      if (akvRow?.status === 'connected') {
        const akv = getAzureKeyVault();
        if (akv) {
          const akvSecrets = await akv.listSecrets();
          for (const s of akvSecrets) {
            local.push({
              id: s.id,
              name: s.name,
              category: s.category,
              description: s.description || `Azure Key Vault (${akv.getVaultName()})`,
              lastRotatedAt: s.updated_at,
              createdAt: s.created_at,
              updatedAt: s.updated_at,
              source: 'azure-keyvault',
              vaultUrl: s.vaultUrl,
              enabled: s.enabled
            });
          }
        }
      }
    } catch (e: any) {
      console.warn('Failed to load Azure Key Vault secrets for unified list:', e.message);
    }

    return local;
  });

  ipcMain.handle(IPC.SECRETS_ADD, async (_event, token: string, name: string, category: string, value: string, description?: string) => {
    const session = sessions.get(token);
    if (!session) throw new Error('Unauthorized');
    if (!secretKey) throw new Error('Vault is locked. Unlock with your passphrase first.');

    const id = crypto.randomUUID();
    const encrypted = encrypt(value, secretKey);
    let spItemId: string | null = null;
    const graphConnector = getGraphConnector();

    if (graphConnector) {
      try {
        const spItem = await graphConnector.createItem('Secrets', { Title: id, EncryptedValue: encrypted });
        spItemId = spItem?.id ?? null;
      } catch (_e) { /* SharePoint unavailable — stored locally only */ }
    }

    db.prepare(
      `INSERT INTO secrets_meta (id, name, category, description, last_rotated_at, sp_item_id, encrypted_value, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run(id, name, category, description ?? '', spItemId, encrypted);

    logAudit(db, session.user.id, 'SecretAdd', id);
    return true;
  });

  ipcMain.handle(IPC.SECRETS_REVEAL, async (_event, token: string, id: string) => {
    const session = sessions.get(token);
    if (!session) throw new Error('Unauthorized');

    // Handle Azure Key Vault secrets
    if (id.includes('.vault.azure.net') || id.startsWith('azure:')) {
      const akv = getAzureKeyVault();
      if (!akv) throw new Error('Azure Key Vault is not connected.');
      const rawName = id.includes('/secrets/') ? id.split('/secrets/')[1].split('/')[0] : id.replace(/^azure:/, '');
      const secretName = decodeURIComponent(rawName);
      const plaintext = await akv.getSecretValue(secretName);
      logAudit(db, session.user.id, 'SecretView', `azure:${secretName}`);
      return plaintext;
    }

    if (!secretKey) throw new Error('Vault is locked');

    const meta = db.prepare('SELECT * FROM secrets_meta WHERE id = ?').get(id) as any;
    if (!meta) throw new Error('Secret not found');

    let encrypted = meta.encrypted_value as string | undefined;
    const graphConnector = getGraphConnector();

    // Prefer SP copy (always up-to-date) when available
    if (!encrypted && graphConnector && meta.sp_item_id) {
      const spItems = await graphConnector.queryList('Secrets', `Title eq '${id}'`);
      encrypted = spItems?.[0]?.EncryptedValue;
    }
    if (!encrypted) throw new Error('No encrypted data found for this secret');

    const plaintext = decrypt(encrypted, secretKey);

    db.prepare(
      `UPDATE secrets_meta SET last_accessed_at = CURRENT_TIMESTAMP, last_accessed_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(session.user.id, id);
    logAudit(db, session.user.id, 'SecretView', id);

    return plaintext;
  });

  ipcMain.handle(IPC.SECRETS_ROTATE, async (_event, token: string, id: string, newValue: string) => {
    const session = sessions.get(token);
    if (!session) throw new Error('Unauthorized');

    if (id.includes('.vault.azure.net') || id.startsWith('azure:')) {
      const akv = getAzureKeyVault();
      if (!akv) throw new Error('Azure Key Vault is not connected.');
      const rawName = id.includes('/secrets/') ? id.split('/secrets/')[1].split('/')[0] : id.replace(/^azure:/, '');
      const secretName = decodeURIComponent(rawName);
      await akv.setSecret(secretName, newValue);
      logAudit(db, session.user.id, 'SecretRotate', `azure:${secretName}`);
      return true;
    }

    if (!secretKey) throw new Error('Vault is locked');

    const meta = db.prepare('SELECT * FROM secrets_meta WHERE id = ?').get(id) as any;
    if (!meta) throw new Error('Secret not found');

    const encrypted = encrypt(newValue, secretKey);
    const graphConnector = getGraphConnector();

    if (graphConnector && meta.sp_item_id) {
      try {
        await graphConnector.updateItem('Secrets', meta.sp_item_id, { EncryptedValue: encrypted });
      } catch (_e) { /* continue — update locally */ }
    }

    db.prepare(
      `UPDATE secrets_meta SET encrypted_value = ?, last_rotated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(encrypted, id);
    logAudit(db, session.user.id, 'SecretRotate', id);
    return true;
  });

  ipcMain.handle(IPC.SECRETS_DELETE, async (_event, token: string, id: string) => {
    const session = sessions.get(token);
    if (!session) throw new Error('Unauthorized');

    if (id.includes('.vault.azure.net') || id.startsWith('azure:')) {
      const akv = getAzureKeyVault();
      if (!akv) throw new Error('Azure Key Vault is not connected.');
      const rawName = id.includes('/secrets/') ? id.split('/secrets/')[1].split('/')[0] : id.replace(/^azure:/, '');
      const secretName = decodeURIComponent(rawName);
      await akv.deleteSecret(secretName);
      logAudit(db, session.user.id, 'SecretDelete', `azure:${secretName}`);
      return true;
    }

    const meta = db.prepare('SELECT * FROM secrets_meta WHERE id = ?').get(id) as any;
    if (!meta) throw new Error('Secret not found');

    const graphConnector = getGraphConnector();
    if (graphConnector && meta.sp_item_id) {
      try {
        await graphConnector.deleteItem('Secrets', meta.sp_item_id);
      } catch (_e) { /* continue */ }
    }

    db.prepare('DELETE FROM secrets_meta WHERE id = ?').run(id);
    logAudit(db, session.user.id, 'SecretDelete', id);
    return true;
  });

  // ── Dedicated Azure Key Vault Handlers ────────────────────────
  ipcMain.handle(IPC.SECRETS_GET_AZURE_STATUS, () => {
    try {
      const row = db.prepare("SELECT status, connected_as, error FROM plugin_configs WHERE plugin_id = 'azure-keyvault'").get() as any;
      return {
        connected: row?.status === 'connected',
        status: row?.status || 'disconnected',
        connectedAs: row?.connected_as || null,
        error: row?.error || null
      };
    } catch {
      return { connected: false, status: 'disconnected', connectedAs: null, error: null };
    }
  });

  ipcMain.handle(IPC.SECRETS_LIST_AZURE, async (_event, token: string) => {
    if (!sessions.has(token)) throw new Error('Unauthorized');
    const akv = getAzureKeyVault();
    if (!akv) return [];
    return await akv.listSecrets();
  });

  ipcMain.handle(IPC.SECRETS_REVEAL_AZURE, async (_event, token: string, secretName: string) => {
    const session = sessions.get(token);
    if (!session) throw new Error('Unauthorized');
    const akv = getAzureKeyVault();
    if (!akv) throw new Error('Azure Key Vault is not connected.');
    const plain = await akv.getSecretValue(secretName);
    logAudit(db, session.user.id, 'SecretView', `azure:${secretName}`);
    return plain;
  });

  ipcMain.handle(IPC.SECRETS_ADD_AZURE, async (_event, token: string, name: string, value: string, category?: string) => {
    const session = sessions.get(token);
    if (!session) throw new Error('Unauthorized');
    const akv = getAzureKeyVault();
    if (!akv) throw new Error('Azure Key Vault is not connected.');
    await akv.setSecret(name, value, category);
    logAudit(db, session.user.id, 'SecretAdd', `azure:${name}`);
    return true;
  });
}
