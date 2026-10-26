import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { atomicWriteFile, ensureDataDirs, getPaths, listJsonFiles, readJsonFile } from './paths.js';
import { WzvtcError } from './errors.js';
import { assertSafeId } from './ids.js';

export type OperationStatus = 'pending' | 'submitted' | 'verified' | 'failed' | 'unknown';

export interface OperationRecord {
  version: 1;
  id: string;
  tool: string;
  inputHash: string;
  accountHash?: string;
  status: OperationStatus;
  createdAt: string;
  updatedAt: string;
  verification?: unknown;
  errorCode?: string;
}

export function createOperation(
  tool: string,
  inputHash: string,
  accountHash?: string,
): OperationRecord {
  ensureDataDirs();
  const now = new Date().toISOString();
  const record: OperationRecord = {
    version: 1,
    id: randomUUID(),
    tool,
    inputHash,
    ...(accountHash ? { accountHash } : {}),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  write(record);
  return record;
}

export function updateOperation(
  id: string,
  patch: Partial<Pick<OperationRecord, 'status' | 'verification' | 'errorCode'>>,
): OperationRecord {
  const record = getOperation(id);
  Object.assign(record, patch, { updatedAt: new Date().toISOString() });
  write(record);
  return record;
}

export function getOperation(id: string): OperationRecord {
  assertSafeId(id, 'operation id');
  const record = readJsonFile<OperationRecord>(`${getPaths().operations}/${id}.json`, 'not_found');
  if (!record) {
    throw new WzvtcError('not_found', `操作 ${id} 不存在`, {
      action: { type: 'run_command', command: 'wzvtc operations list', message: '查看最近操作' },
    });
  }
  return record;
}

export function listOperations(): OperationRecord[] {
  return listJsonFiles(getPaths().operations)
    .map((file) => readJsonFile<OperationRecord>(file, 'not_found'))
    .filter((record): record is OperationRecord => record !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function deleteOperation(id: string): void {
  assertSafeId(id, 'operation id');
  fs.rmSync(`${getPaths().operations}/${id}.json`, { force: true });
}

function write(record: OperationRecord): void {
  atomicWriteFile(
    `${getPaths().operations}/${record.id}.json`,
    `${JSON.stringify(record, null, 2)}\n`,
    0o600,
  );
}
