import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { WzvtcError, type ErrorCode } from './errors.js';

export interface DataPaths {
  root: string;
  config: string;
  vault: string;
  pending: string;
  operations: string;
  logs: string;
  cache: string;
}

export function getDataDir(): string {
  const override = process.env.WZVTC_HOME?.trim();
  if (override) return path.resolve(override);
  return path.join(os.homedir(), '.wzvtc-anything');
}

export function getPaths(): DataPaths {
  const root = getDataDir();
  return {
    root,
    config: path.join(root, 'config.json'),
    vault: path.join(root, 'vault.json'),
    pending: path.join(root, 'pending'),
    operations: path.join(root, 'operations'),
    logs: path.join(root, 'logs'),
    cache: path.join(root, 'cache'),
  };
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // Windows may not implement POSIX modes; ACLs still apply.
  }
}

export function ensureDataDirs(): DataPaths {
  const paths = getPaths();
  ensureDir(paths.root);
  ensureDir(paths.pending);
  ensureDir(paths.operations);
  ensureDir(paths.logs);
  ensureDir(paths.cache);
  return paths;
}

export function fileExists(file: string): boolean {
  return fs.existsSync(file);
}

export function readJsonFile<T>(file: string, code: ErrorCode = 'internal_error'): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch (error) {
    throw new WzvtcError(code, `无法解析 ${path.basename(file)}`, {
      cause: error,
      action: {
        type: 'ask_user',
        message: '文件可能损坏；请备份后重试或运行 vault reset --purge',
        requires_user: true,
      },
    });
  }
}

export function atomicWriteFile(file: string, data: string, mode = 0o600): void {
  ensureDir(path.dirname(file));
  const temp = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temp, data, { mode });
  try {
    fs.renameSync(temp, file);
  } catch (error) {
    // Windows can refuse to replace an existing file atomically.
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    try {
      fs.renameSync(temp, file);
    } catch (retryError) {
      fs.rmSync(temp, { force: true });
      throw new WzvtcError('internal_error', `写入 ${path.basename(file)} 失败`, {
        cause: retryError ?? error,
      });
    }
  }
  try {
    fs.chmodSync(file, mode);
  } catch {
    // Windows may not implement POSIX modes.
  }
}

export function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(dir, name));
}
