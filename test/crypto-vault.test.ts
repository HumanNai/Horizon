import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as crypto from 'crypto';

describe('Vault Cryptography AES-256-GCM & PBKDF2 Test Suite', () => {
  function deriveKey(passphrase: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
  }

  function encrypt(text: string, key: Buffer) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
  }

  function decrypt(ciphertext: string, key: Buffer, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  }

  test('successfully derives 256-bit key from passphrase and salt', () => {
    const salt = crypto.randomBytes(16);
    const key = deriveKey('MasterPassphrase123!', salt);
    assert.strictEqual(key.length, 32, 'Key should be exactly 32 bytes (256 bits)');
  });

  test('encrypts and decrypts secret plaintext with AES-256-GCM authentication', () => {
    const salt = crypto.randomBytes(16);
    const key = deriveKey('HorizonSecretKey#2026', salt);
    const secretPlaintext = 'prod_api_key_xyz987654321_token';

    const payload = encrypt(secretPlaintext, key);
    assert.notStrictEqual(payload.ciphertext, secretPlaintext);

    const decrypted = decrypt(payload.ciphertext, key, payload.iv, payload.authTag);
    assert.strictEqual(decrypted, secretPlaintext, 'Decrypted secret should match original plaintext');
  });

  test('fails decryption if wrong key or corrupted ciphertext is supplied', () => {
    const salt = crypto.randomBytes(16);
    const key1 = deriveKey('PassphraseOne', salt);
    const key2 = deriveKey('PassphraseTwo', salt);

    const payload = encrypt('confidential_data', key1);

    assert.throws(() => {
      decrypt(payload.ciphertext, key2, payload.iv, payload.authTag);
    }, 'Decryption with mismatched key should throw authentication error');
  });
});
