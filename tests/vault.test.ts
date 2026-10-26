import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryKeychain } from '../src/core/vault/keychain.js';
import { Vault, type XgxtSession } from '../src/core/vault/vault.js';

const session: XgxtSession = {
  accessToken: 'secret-access-token',
  refreshToken: 'secret-refresh-token',
  baseUrl: 'https://xgxt.wzvtc.cn/PhoneApi/api',
  obtainedAt: '2026-10-26T00:00:00.000Z',
};

let tempDir: string;

function makeVault(vaultPath: string, keychain: MemoryKeychain, state: { deviceId?: string }): Vault {
  return new Vault({
    keychain,
    vaultPath,
    getDeviceId: () => state.deviceId,
    setDeviceId: (deviceId) => {
      state.deviceId = deviceId;
    },
    clearDeviceId: () => {
      state.deviceId = undefined;
    },
    now: () => new Date('2026-10-26T00:00:00.000Z'),
  });
}

describe('Vault', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wzvtc-vault-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes, stores a session, and does not write plaintext', async () => {
    const vaultPath = path.join(tempDir, 'vault.json');
    const keychain = new MemoryKeychain();
    const state: { deviceId?: string } = {};
    const vault = makeVault(vaultPath, keychain, state);

    await vault.init('password123', false);
    expect(vault.status().initialized).toBe(true);
    expect(vault.status().deviceTrusted).toBe(false);

    await vault.openWithMasterPassword('password123');
    vault.saveSession('xgxt', session);

    const raw = fs.readFileSync(vaultPath, 'utf8');
    expect(raw).not.toContain('secret-access-token');
    expect(raw).not.toContain('secret-refresh-token');

    const reopened = makeVault(vaultPath, keychain, state);
    await reopened.openWithMasterPassword('password123');
    expect(reopened.getSession('xgxt')?.accessToken).toBe('secret-access-token');
    expect(reopened.listItems()).toHaveLength(1);
    expect(JSON.stringify(reopened.listItems())).not.toContain('secret-access-token');
  });

  it('rejects a wrong master password', async () => {
    const vaultPath = path.join(tempDir, 'vault.json');
    const keychain = new MemoryKeychain();
    const state: { deviceId?: string } = {};
    const vault = makeVault(vaultPath, keychain, state);
    await vault.init('password123', false);

    await expect(vault.openWithMasterPassword('wrong-password')).rejects.toMatchObject({
      code: 'master_password_invalid',
    });
  });

  it('trusts a device and unlocks without the master password', async () => {
    const vaultPath = path.join(tempDir, 'vault.json');
    const keychain = new MemoryKeychain();
    const state: { deviceId?: string } = {};
    const vault = makeVault(vaultPath, keychain, state);

    await vault.init('password123', true);
    expect(vault.status().deviceTrusted).toBe(true);
    vault.saveSession('xgxt', session);

    const reopened = makeVault(vaultPath, keychain, state);
    await reopened.open();
    expect(reopened.getSession('xgxt')?.accessToken).toBe('secret-access-token');
  });

  it('revokes a trusted device and removes its keychain entry', async () => {
    const vaultPath = path.join(tempDir, 'vault.json');
    const keychain = new MemoryKeychain();
    const state: { deviceId?: string } = {};
    const vault = makeVault(vaultPath, keychain, state);
    await vault.init('password123', true);
    const deviceId = state.deviceId!;
    expect(deviceId).toBeTruthy();
    expect(vault.status().deviceTrusted).toBe(true);

    const result = vault.revokeDevice(deviceId);
    expect(result).toEqual({ revoked: true, current: true });
    expect(keychain.get(`device:${deviceId}`)).toBeNull();
    expect(state.deviceId).toBeUndefined();
    expect(vault.status().deviceTrusted).toBe(false);
  });

  it('purges vault, keychain trust, and local operation state', async () => {
    process.env.WZVTC_HOME = tempDir;
    try {
      const vaultPath = path.join(tempDir, 'vault.json');
      const keychain = new MemoryKeychain();
      const state: { deviceId?: string } = {};
      const vault = makeVault(vaultPath, keychain, state);
      await vault.init('password123', true);
      const deviceId = state.deviceId!;
      fs.mkdirSync(path.join(tempDir, 'pending'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'pending', 'test.json'), '{}');

      const result = vault.resetPurge();
      expect(result.removedDevices).toBe(1);
      expect(fs.existsSync(vaultPath)).toBe(false);
      expect(fs.existsSync(path.join(tempDir, 'pending'))).toBe(false);
      expect(keychain.get(`device:${deviceId}`)).toBeNull();
      expect(state.deviceId).toBeUndefined();
    } finally {
      delete process.env.WZVTC_HOME;
    }
  });

  it('rejects KDF parameters outside the allowed bounds', async () => {
    const vaultPath = path.join(tempDir, 'vault.json');
    const keychain = new MemoryKeychain();
    const state: { deviceId?: string } = {};
    const vault = makeVault(vaultPath, keychain, state);
    await vault.init('password123', false);

    const parsed = JSON.parse(fs.readFileSync(vaultPath, 'utf8')) as {
      header: { kdf: { params: { memorySize: number } } };
    };
    parsed.header.kdf.params.memorySize = 1;
    fs.writeFileSync(vaultPath, JSON.stringify(parsed));

    const reopened = makeVault(vaultPath, keychain, state);
    await expect(reopened.openWithMasterPassword('password123')).rejects.toMatchObject({
      code: 'vault_corrupt',
    });
  });

  it('detects a tampered vault entry', async () => {
    const vaultPath = path.join(tempDir, 'vault.json');
    const keychain = new MemoryKeychain();
    const state: { deviceId?: string } = {};
    const vault = makeVault(vaultPath, keychain, state);
    await vault.init('password123', false);
    vault.saveSession('xgxt', session);

    const parsed = JSON.parse(fs.readFileSync(vaultPath, 'utf8')) as {
      items: Array<{ ciphertext: string }>;
    };
    parsed.items[0].ciphertext = Buffer.from('tampered').toString('base64');
    fs.writeFileSync(vaultPath, JSON.stringify(parsed));

    const reopened = makeVault(vaultPath, keychain, state);
    await reopened.openWithMasterPassword('password123');
    expect(() => reopened.getSession('xgxt')).toThrowError();
  });
});
