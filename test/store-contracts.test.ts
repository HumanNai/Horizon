import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

describe('Horizon IPC Contracts & Types Integrity Test Suite', () => {
  const typesPath = path.join(process.cwd(), 'src', 'types', 'index.ts');
  const typesContent = fs.readFileSync(typesPath, 'utf8');

  test('types index file exists and exports IPC channels object', () => {
    assert.ok(fs.existsSync(typesPath), 'src/types/index.ts should exist');
    assert.ok(typesContent.includes('export const IPC = {'), 'IPC channel constant mapping should exist');
  });

  test('includes core IPC channels across all functional domains', () => {
    const requiredChannels = [
      'AUTH_LOGIN',
      'AUTH_LOGOUT',
      'DB_QUERY',
      'DB_EXECUTE',
      'SECRETS_UNLOCK',
      'SECRETS_LOCK',
      'GRAPH_QUERY_LIST',
      'SYNC_TRIGGER',
      'SYNC_STATUS',
      'NOTIFY_SCHEDULE',
      'PLUGIN_LIST',
      'WINDOW_MINIMIZE',
      'WINDOW_MAXIMIZE'
    ];

    for (const channel of requiredChannels) {
      assert.ok(typesContent.includes(channel), `IPC channel '${channel}' must be declared in IPC enum/object`);
    }
  });

  test('declares complete domain data models', () => {
    const domainInterfaces = [
      'HorizonUser',
      'Product',
      'Release',
      'Task',
      'UATCase',
      'SecretMeta',
      'SyncState',
      'PluginConfig'
    ];

    for (const iface of domainInterfaces) {
      const ifaceRegex = new RegExp(`interface\\s+${iface}\\b`, 'i');
      assert.ok(ifaceRegex.test(typesContent), `Interface '${iface}' must be declared in shared types`);
    }
  });
});
