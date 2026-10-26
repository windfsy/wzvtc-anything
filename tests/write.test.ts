import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listOperations } from '../src/core/operations.js';
import { createPending, hashInput, packConfirmToken } from '../src/core/pending.js';
import { executeConfirmedWrite } from '../src/cli/write.js';

let tempDir: string;

describe('confirmed write pipeline', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wzvtc-write-test-'));
    process.env.WZVTC_HOME = tempDir;
  });

  afterEach(() => {
    delete process.env.WZVTC_HOME;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('consumes the token, executes, verifies, and records the operation', async () => {
    const tool = 'dekt.activity.enroll';
    const inputHash = hashInput({ activityId: 'activity-1', roleId: 'role-1' });
    const pending = createPending(tool, inputHash, { activity: 'test' }, {
      sessionHash: 'session-a',
    });

    const result = await executeConfirmedWrite({
      tool,
      inputHash,
      sessionHash: 'session-a',
      confirm: packConfirmToken(pending.id, pending.token),
      summary: { activity: 'test' },
      execute: async () => ({ ok: true, status: 200 }),
      verify: async () => ({ status: 'verified', note: 'ok' }),
    });

    expect(result).toMatchObject({ executed: true, upstream_status: 200 });
    const operations = listOperations();
    expect(operations).toHaveLength(1);
    expect(operations[0]?.status).toBe('verified');
  });

  it('rejects a stale input hash', async () => {
    const tool = 'dekt.activity.enroll';
    const inputHash = hashInput({ activityId: 'activity-1', roleId: 'role-1' });
    const pending = createPending(tool, inputHash, { activity: 'test' }, {
      sessionHash: 'session-a',
    });

    await expect(
      executeConfirmedWrite({
        tool,
        inputHash: hashInput({ activityId: 'activity-2' }),
        sessionHash: 'session-a',
        confirm: packConfirmToken(pending.id, pending.token),
        summary: { activity: 'test' },
        execute: async () => ({ ok: true, status: 200 }),
        verify: async () => ({ status: 'verified' }),
      }),
    ).rejects.toMatchObject({ code: 'confirmation_expired' });
  });

  it('rejects a preview made under another account/session', async () => {
    const tool = 'dekt.activity.enroll';
    const inputHash = hashInput({ activityId: 'activity-1', roleId: 'role-1' });
    const pending = createPending(tool, inputHash, { activity: 'test' }, {
      sessionHash: 'session-a',
    });

    await expect(
      executeConfirmedWrite({
        tool,
        inputHash,
        sessionHash: 'session-b',
        confirm: packConfirmToken(pending.id, pending.token),
        summary: { activity: 'test' },
        execute: async () => ({ ok: true, status: 200 }),
        verify: async () => ({ status: 'verified' }),
      }),
    ).rejects.toMatchObject({ code: 'confirmation_expired' });
  });

  it('marks an unknown write outcome instead of treating it as success', async () => {
    const tool = 'dekt.activity.enroll';
    const inputHash = hashInput({ activityId: 'activity-1', roleId: 'role-1' });
    const pending = createPending(tool, inputHash, { activity: 'test' }, {
      sessionHash: 'session-a',
    });

    await expect(
      executeConfirmedWrite({
        tool,
        inputHash,
        sessionHash: 'session-a',
        confirm: packConfirmToken(pending.id, pending.token),
        summary: { activity: 'test' },
        execute: async () => ({ ok: false, status: 502, unknown: true }),
        verify: async () => ({ status: 'verified' }),
      }),
    ).rejects.toMatchObject({ code: 'network_error', sideEffectPossible: true });

    const operations = listOperations();
    expect(operations[0]?.status).toBe('unknown');
  });
});
