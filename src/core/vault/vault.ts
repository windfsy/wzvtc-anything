import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { clearDeviceId, getDeviceId, setDeviceId } from '../config.js';
import { WzvtcError } from '../errors.js';
import { atomicWriteFile, getPaths, readJsonFile } from '../paths.js';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  DEFAULT_KDF,
  deriveKek,
  randomBytesBase64,
  randomToken,
  unwrapKey,
  wrapKey,
  type KdfParams,
  type WrappedKey,
} from './crypto.js';
import type { Keychain } from './keychain.js';

export interface VaultHeader {
  version: 1;
  kdf: {
    name: 'argon2id';
    params: KdfParams;
    salt: string;
  };
  wrappedDekByKek: WrappedKey;
  deviceWraps: Array<{
    deviceId: string;
    wrappedDek: WrappedKey;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type VaultItemType = 'session' | 'password' | 'meta';

export interface VaultItem {
  id: string;
  provider: string;
  account: string;
  type: VaultItemType;
  nonce: string;
  ciphertext: string;
  tag: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultFile {
  header: VaultHeader;
  items: VaultItem[];
}

export interface ProviderSession {
  accessToken: string;
  refreshToken?: string;
  baseUrl: string;
  obtainedAt: string;
  userId?: string;
}

export type XgxtSession = ProviderSession;

export interface VaultOptions {
  keychain: Keychain;
  vaultPath?: string;
  getDeviceId?: () => string | undefined;
  setDeviceId?: (deviceId: string) => void;
  clearDeviceId?: () => void;
  now?: () => Date;
}

export interface VaultStatus {
  initialized: boolean;
  deviceTrusted: boolean;
  trustedDevices: number;
  items: number;
}

export class Vault {
  private readonly vaultPath: string;
  private readonly keychain: Keychain;
  private readonly readDeviceId: () => string | undefined;
  private readonly writeDeviceId: (deviceId: string) => void;
  private readonly removeDeviceId: () => void;
  private readonly now: () => Date;
  private file: VaultFile | null = null;
  private dek: Buffer | null = null;

  constructor(options: VaultOptions) {
    this.vaultPath = options.vaultPath ?? getPaths().vault;
    this.keychain = options.keychain;
    this.readDeviceId = options.getDeviceId ?? getDeviceId;
    this.writeDeviceId = options.setDeviceId ?? setDeviceId;
    this.removeDeviceId = options.clearDeviceId ?? clearDeviceId;
    this.now = options.now ?? (() => new Date());
  }

  exists(): boolean {
    return readJsonFile<VaultFile>(this.vaultPath, 'vault_corrupt') !== null;
  }

  loadFile(): VaultFile {
    const data = readJsonFile<VaultFile>(this.vaultPath, 'vault_corrupt');
    if (!data) {
      throw new WzvtcError('vault_not_initialized', 'Vault 尚未初始化', {
        action: {
          type: 'run_command',
          command: 'wzvtc vault init',
          message: '请先在终端初始化 Vault',
          requires_user: true,
        },
      });
    }
    const params = data.header?.kdf?.params;
    const salt = data.header?.kdf?.salt;
    const validKdf =
      params !== undefined &&
      Number.isInteger(params.memorySize) &&
      params.memorySize >= 8192 &&
      params.memorySize <= 1_048_576 &&
      Number.isInteger(params.iterations) &&
      params.iterations >= 1 &&
      params.iterations <= 10 &&
      Number.isInteger(params.parallelism) &&
      params.parallelism >= 1 &&
      params.parallelism <= 8 &&
      params.hashLength === 32 &&
      typeof salt === 'string' &&
      Buffer.from(salt, 'base64').length === 16;

    if (
      !data.header ||
      data.header.version !== 1 ||
      !data.header.kdf ||
      data.header.kdf.name !== 'argon2id' ||
      !validKdf ||
      !Array.isArray(data.items) ||
      !Array.isArray(data.header.deviceWraps)
    ) {
      throw new WzvtcError('vault_corrupt', 'Vault 格式不受支持或已损坏', {
        action: {
          type: 'ask_user',
          message: '请备份 vault.json 后运行 wzvtc vault reset --purge',
          requires_user: true,
        },
      });
    }
    this.file = data;
    return data;
  }

  async init(masterPassword: string, trustDevice: boolean): Promise<{ trustedDevice: boolean }> {
    if (this.exists()) {
      throw new WzvtcError('precondition_failed', 'Vault 已存在', {
        action: { type: 'none', message: '如需重建，请先运行 wzvtc vault reset --purge' },
      });
    }
    if (masterPassword.length < 8) {
      throw new WzvtcError('invalid_input', '主密码至少 8 个字符');
    }

    const salt = randomBytesBase64(16);
    const kek = await deriveKek(masterPassword, salt, DEFAULT_KDF);
    const dek = Buffer.from(randomBytesBase64(32), 'base64');
    const wrappedDekByKek = wrapKey(kek, dek);
    kek.fill(0);

    const createdAt = this.now().toISOString();
    const header: VaultHeader = {
      version: 1,
      kdf: { name: 'argon2id', params: { ...DEFAULT_KDF }, salt },
      wrappedDekByKek,
      deviceWraps: [],
      createdAt,
      updatedAt: createdAt,
    };
    const file: VaultFile = { header, items: [] };

    if (trustDevice) {
      if (!this.keychain.isAvailable()) {
        throw new WzvtcError('keychain_unavailable', '系统钥匙串不可用，无法信任此设备', {
          action: {
            type: 'ask_user',
            message: '请改用不信任设备的初始化方式，或换到支持钥匙串的环境',
            requires_user: true,
          },
        });
      }
      const deviceId = randomUUID();
      const deviceKey = Buffer.from(randomBytesBase64(32), 'base64');
      try {
        this.keychain.set(`device:${deviceId}`, deviceKey.toString('base64'));
      } catch (error) {
        throw new WzvtcError('keychain_unavailable', '无法写入系统钥匙串', { cause: error });
      }
      header.deviceWraps.push({
        deviceId,
        wrappedDek: wrapKey(deviceKey, dek),
        createdAt,
      });
      this.writeDeviceId(deviceId);
      deviceKey.fill(0);
    }

    this.file = file;
    this.dek = dek;
    this.save();
    return { trustedDevice: trustDevice };
  }

  async openWithDeviceKey(): Promise<void> {
    const file = this.file ?? this.loadFile();
    const deviceId = this.readDeviceId();
    if (!deviceId) {
      throw new WzvtcError('master_password_required', '当前设备未信任，需要主密码', {
        action: {
          type: 'ask_user',
          message: '请在终端重跑该命令并输入 Vault 主密码，或先信任此设备；Agent 不得索取主密码',
          requires_user: true,
        },
      });
    }
    const deviceWrap = file.header.deviceWraps.find((entry) => entry.deviceId === deviceId);
    const deviceKeyBase64 = this.keychain.get(`device:${deviceId}`);
    if (!deviceWrap || !deviceKeyBase64) {
      throw new WzvtcError('master_password_required', '当前设备未信任，需要主密码', {
        action: {
          type: 'ask_user',
          message: '请在终端重跑该命令并输入 Vault 主密码，或重新信任此设备；Agent 不得索取主密码',
          requires_user: true,
        },
      });
    }
    const deviceKey = Buffer.from(deviceKeyBase64, 'base64');
    try {
      this.dek = unwrapKey(deviceKey, deviceWrap.wrappedDek);
    } catch (error) {
      throw new WzvtcError('master_password_required', '设备密钥无法解锁 Vault，需要主密码', {
        action: {
          type: 'ask_user',
          message: '请在终端重跑命令并输入主密码；如果主密码也失败，Vault 可能已损坏',
          requires_user: true,
        },
        cause: error,
      });
    } finally {
      deviceKey.fill(0);
    }
  }

  async openWithMasterPassword(masterPassword: string): Promise<void> {
    const file = this.file ?? this.loadFile();
    const kek = await deriveKek(masterPassword, file.header.kdf.salt, file.header.kdf.params);
    try {
      this.dek = unwrapKey(kek, file.header.wrappedDekByKek);
    } catch (error) {
      throw new WzvtcError('master_password_invalid', '主密码错误或 Vault 已损坏', {
        cause: error,
        action: {
          type: 'ask_user',
          message: '请重试；如果确认密码正确，请备份 vault.json 后重置',
          requires_user: true,
        },
      });
    } finally {
      kek.fill(0);
    }
  }

  async open(): Promise<void> {
    if (this.dek) return;
    await this.openWithDeviceKey();
  }

  isDeviceTrusted(): boolean {
    const data = readJsonFile<VaultFile>(this.vaultPath, 'vault_corrupt');
    if (!data) return false;
    const deviceId = this.readDeviceId();
    if (!deviceId) return false;
    if (!data.header.deviceWraps.some((entry) => entry.deviceId === deviceId)) return false;
    return this.keychain.get(`device:${deviceId}`) !== null;
  }

  status(): VaultStatus {
    const data = readJsonFile<VaultFile>(this.vaultPath, 'vault_corrupt');
    if (!data) return { initialized: false, deviceTrusted: false, trustedDevices: 0, items: 0 };
    return {
      initialized: true,
      deviceTrusted: this.isDeviceTrusted(),
      trustedDevices: data.header.deviceWraps.length,
      items: data.items.length,
    };
  }

  async trustCurrentDevice(): Promise<void> {
    this.ensureDek();
    if (!this.keychain.isAvailable()) {
      throw new WzvtcError('keychain_unavailable', '系统钥匙串不可用');
    }
    const file = this.file ?? this.loadFile();
    const deviceId = this.readDeviceId() ?? randomUUID();
    const deviceKey = Buffer.from(randomBytesBase64(32), 'base64');
    try {
      this.keychain.set(`device:${deviceId}`, deviceKey.toString('base64'));
    } catch (error) {
      throw new WzvtcError('keychain_unavailable', '无法写入系统钥匙串', { cause: error });
    }
    const wrappedDek = wrapKey(deviceKey, this.dek!);
    deviceKey.fill(0);
    const existing = file.header.deviceWraps.findIndex((entry) => entry.deviceId === deviceId);
    const record = { deviceId, wrappedDek, createdAt: this.now().toISOString() };
    if (existing >= 0) {
      file.header.deviceWraps[existing] = record;
    } else {
      file.header.deviceWraps.push(record);
    }
    this.writeDeviceId(deviceId);
    this.save();
  }

  listDevices(): Array<{ deviceId: string; createdAt: string }> {
    const file = this.file ?? this.loadFile();
    return file.header.deviceWraps.map((entry) => ({
      deviceId: entry.deviceId,
      createdAt: entry.createdAt,
    }));
  }

  revokeDevice(deviceId: string): { revoked: boolean; current: boolean } {
    const file = this.file ?? this.loadFile();
    const index = file.header.deviceWraps.findIndex((entry) => entry.deviceId === deviceId);
    if (index < 0) return { revoked: false, current: false };
    const current = this.readDeviceId() === deviceId;
    this.keychain.delete(`device:${deviceId}`);
    file.header.deviceWraps.splice(index, 1);
    if (current) {
      this.removeDeviceId();
      this.dek = null;
    }
    this.save();
    return { revoked: true, current };
  }

  resetPurge(): { removedDevices: number } {
    let file: VaultFile | null = null;
    try {
      file = readJsonFile<VaultFile>(this.vaultPath, 'vault_corrupt');
    } catch {
      file = null;
    }
    const devices = file?.header.deviceWraps ?? [];
    for (const device of devices) {
      this.keychain.delete(`device:${device.deviceId}`);
    }
    this.removeDeviceId();
    fs.rmSync(this.vaultPath, { force: true });

    const paths = getPaths();
    for (const dir of [paths.pending, paths.operations, paths.logs, paths.cache]) {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }
    const directory = path.dirname(this.vaultPath);
    const basename = path.basename(this.vaultPath);
    if (fs.existsSync(directory)) {
      for (const entry of fs.readdirSync(directory)) {
        if (entry.startsWith(`${basename}.`) && entry.endsWith('.tmp')) {
          fs.rmSync(path.join(directory, entry), { force: true });
        }
      }
    }

    this.file = null;
    this.dek = null;
    return { removedDevices: devices.length };
  }

  listItems(): Array<Omit<VaultItem, 'nonce' | 'ciphertext' | 'tag'>> {
    this.ensureDek();
    const file = this.file ?? this.loadFile();
    return file.items.map(({ nonce: _nonce, ciphertext: _ciphertext, tag: _tag, ...meta }) => meta);
  }

  getSession(provider: string, account = 'default'): XgxtSession | null {
    this.ensureDek();
    const value = this.getItem(provider, 'session', account);
    return value ? (JSON.parse(value) as XgxtSession) : null;
  }

  saveSession(provider: string, session: XgxtSession, account = 'default'): void {
    this.setItem(provider, 'session', account, JSON.stringify(session));
  }

  deleteSession(provider: string, account = 'default'): void {
    this.deleteItem(provider, 'session', account);
  }

  getItem(provider: string, type: VaultItemType, account = 'default'): string | null {
    this.ensureDek();
    const file = this.file ?? this.loadFile();
    const item = file.items.find(
      (entry) => entry.provider === provider && entry.type === type && entry.account === account,
    );
    if (!item) return null;
    try {
      return aesGcmDecrypt(this.dek!, item, `${item.id}:${item.type}`).toString('utf8');
    } catch (error) {
      throw new WzvtcError('vault_corrupt', 'Vault 条目无法解密', { cause: error });
    }
  }

  setItem(provider: string, type: VaultItemType, account: string, value: string): void {
    this.ensureDek();
    const file = this.file ?? this.loadFile();
    const existing = file.items.find(
      (entry) => entry.provider === provider && entry.type === type && entry.account === account,
    );
    const now = this.now().toISOString();
    const id = existing?.id ?? randomToken(16);
    const wrapped = aesGcmEncrypt(this.dek!, Buffer.from(value, 'utf8'), `${id}:${type}`);
    const item: VaultItem = {
      id,
      provider,
      account,
      type,
      ...wrapped,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) {
      const index = file.items.indexOf(existing);
      file.items[index] = item;
    } else {
      file.items.push(item);
    }
    this.save();
  }

  deleteItem(provider: string, type: VaultItemType, account = 'default'): boolean {
    this.ensureDek();
    const file = this.file ?? this.loadFile();
    const index = file.items.findIndex(
      (entry) => entry.provider === provider && entry.type === type && entry.account === account,
    );
    if (index < 0) return false;
    file.items.splice(index, 1);
    this.save();
    return true;
  }

  private ensureDek(): void {
    if (!this.dek) {
      throw new WzvtcError('vault_locked', 'Vault 尚未解锁', {
        action: {
          type: 'ask_user',
          message: '请在终端重跑该命令并输入 Vault 主密码，或先信任此设备；Agent 不得索取主密码',
          requires_user: true,
        },
      });
    }
  }

  private save(): void {
    if (!this.file) throw new WzvtcError('internal_error', 'Vault 尚未加载');
    this.file.header.updatedAt = this.now().toISOString();
    atomicWriteFile(this.vaultPath, `${JSON.stringify(this.file, null, 2)}\n`, 0o600);
  }
}
