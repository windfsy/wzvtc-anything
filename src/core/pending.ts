import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { canonicalJson } from './json.js';
import { redactObject } from './redact.js';
import { sha256Hex, randomToken, safeEqualHex } from './vault/crypto.js';
import { atomicWriteFile, ensureDataDirs, getPaths, listJsonFiles, readJsonFile } from './paths.js';
import { WzvtcError } from './errors.js';
import { assertSafeId } from './ids.js';

export interface PendingRecord {
  version: 1;
  id: string;
  tool: string;
  inputHash: string;
  tokenHash: string;
  summary: unknown;
  createdAt: string;
  expiresAt: string;
  sessionHash?: string;
}

export interface PendingResult {
  id: string;
  token: string;
  expiresAt: string;
}

export interface PendingOptions {
  ttlMs?: number;
  sessionHash?: string;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function hashInput(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function packConfirmToken(id: string, token: string): string {
  return `${id}.${token}`;
}

export function unpackConfirmToken(confirm: string): { id: string; token: string } {
  const separator = confirm.indexOf('.');
  if (separator <= 0 || separator === confirm.length - 1) {
    throw new WzvtcError('confirmation_expired', 'confirm token 格式不正确', {
      action: { type: 'ask_user', message: '请重新预览后再确认', requires_user: true },
    });
  }
  return { id: confirm.slice(0, separator), token: confirm.slice(separator + 1) };
}

export function createPending(
  tool: string,
  inputHash: string,
  summary: unknown,
  options: PendingOptions = {},
): PendingResult {
  ensureDataDirs();
  const paths = getPaths();
  const id = randomUUID();
  const token = randomToken(24);
  const now = new Date();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const record: PendingRecord = {
    version: 1,
    id,
    tool,
    inputHash,
    tokenHash: sha256Hex(token),
    summary: redactObject(summary),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    ...(options.sessionHash ? { sessionHash: options.sessionHash } : {}),
  };
  atomicWriteFile(`${paths.pending}/${id}.json`, `${JSON.stringify(record, null, 2)}\n`, 0o600);
  return { id, token, expiresAt: record.expiresAt };
}

export function consumePending(id: string, token: string): PendingRecord {
  assertSafeId(id, 'pending id');
  const paths = getPaths();
  const file = `${paths.pending}/${id}.json`;
  const record = readJsonFile<PendingRecord>(file, 'confirmation_expired');
  if (!record) {
    throw new WzvtcError('confirmation_expired', '确认信息不存在或已使用', {
      action: {
        type: 'run_command',
        command: '重新运行写命令进行预览',
        message: '请重新预览后再确认',
        requires_user: false,
      },
    });
  }
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    fs.rmSync(file, { force: true });
    throw new WzvtcError('confirmation_expired', '确认已过期', {
      action: { type: 'ask_user', message: '请重新预览后再确认', requires_user: true },
    });
  }
  if (!safeEqualHex(sha256Hex(token), record.tokenHash)) {
    throw new WzvtcError('confirmation_expired', '确认 token 不匹配', {
      action: { type: 'ask_user', message: '请重新预览后再确认', requires_user: true },
    });
  }
  fs.rmSync(file, { force: true });
  return record;
}

export function cleanupExpiredPending(): number {
  let removed = 0;
  for (const file of listJsonFiles(getPaths().pending)) {
    const record = readJsonFile<PendingRecord>(file, 'confirmation_expired');
    if (!record || new Date(record.expiresAt).getTime() < Date.now()) {
      fs.rmSync(file, { force: true });
      removed += 1;
    }
  }
  return removed;
}
