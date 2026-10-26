import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  consumePending,
  createPending,
  hashInput,
  packConfirmToken,
  unpackConfirmToken,
} from '../src/core/pending.js';

let tempDir: string;

describe('pending confirm tokens', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wzvtc-pending-test-'));
    process.env.WZVTC_HOME = tempDir;
  });

  afterEach(() => {
    delete process.env.WZVTC_HOME;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a pending record and consumes it once', () => {
    const pending = createPending('tool.test', hashInput({ a: 1 }), {
      phone: '13800138000',
      token: 'secret',
    });
    const confirm = packConfirmToken(pending.id, pending.token);
    const unpacked = unpackConfirmToken(confirm);
    expect(unpacked.id).toBe(pending.id);
    expect(unpacked.token).toBe(pending.token);

    const raw = fs.readFileSync(
      path.join(tempDir, 'pending', `${pending.id}.json`),
      'utf8',
    );
    expect(raw).not.toContain('13800138000');
    expect(raw).not.toContain('"secret"');

    const record = consumePending(unpacked.id, unpacked.token);
    expect(record.tool).toBe('tool.test');
    expect(() => consumePending(unpacked.id, unpacked.token)).toThrowError();
  });

  it('rejects a wrong token', () => {
    const pending = createPending('tool.test', hashInput({ a: 1 }), {});
    expect(() => consumePending(pending.id, 'wrong-token')).toThrowError();
  });

  it('rejects an expired pending record', () => {
    const pending = createPending('tool.test', hashInput({ a: 1 }), {}, { ttlMs: -1 });
    expect(() => consumePending(pending.id, pending.token)).toThrowError();
  });

  it('rejects a malformed packed token', () => {
    expect(() => unpackConfirmToken('no-dot')).toThrowError();
  });

  it('rejects a path traversal id before touching the filesystem', () => {
    expect(() => consumePending('../config', 'token')).toThrowError();
  });
});
