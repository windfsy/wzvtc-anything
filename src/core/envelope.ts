import { randomUUID } from 'node:crypto';
import { SCHEMA_VERSION, CLI_VERSION } from './version.js';
import { exitCodeFor, WzvtcError } from './errors.js';
import { redactObject, redactText } from './redact.js';

export interface Meta {
  schema_version: string;
  cli_version: string;
  request_id: string;
  next_cursor?: string;
  has_more?: boolean;
}

export interface OkEnvelope<T> {
  ok: true;
  data: T;
  meta: Meta;
}

export interface ErrorBody {
  code: string;
  message: string;
  action: {
    type: string;
    message: string;
    command?: string;
    requires_user?: boolean;
  };
  retryable: boolean;
  side_effect_possible: boolean;
  details?: Record<string, unknown>;
}

export interface ErrEnvelope {
  ok: false;
  error: ErrorBody;
  meta: Meta;
}

function meta(extra?: Partial<Meta>): Meta {
  return {
    schema_version: SCHEMA_VERSION,
    cli_version: CLI_VERSION,
    request_id: randomUUID(),
    ...extra,
  };
}

export function success<T>(data: T, extra?: Partial<Meta>): OkEnvelope<T> {
  return { ok: true, data: redactObject(data), meta: meta(extra) };
}

export function failure(error: WzvtcError): ErrEnvelope {
  return {
    ok: false,
    error: {
      code: error.code,
      message: redactText(error.message),
      action: {
        ...error.action,
        message: redactText(error.action.message),
        command: error.action.command ? redactText(error.action.command) : undefined,
      },
      retryable: error.retryable,
      side_effect_possible: error.sideEffectPossible,
      details: error.details ? redactObject(error.details) : undefined,
    },
    meta: meta(),
  };
}

export function emitOk<T>(data: T, extra?: Partial<Meta>): void {
  process.stdout.write(`${JSON.stringify(success(data, extra))}\n`);
}

export function emitError(error: WzvtcError): void {
  process.stdout.write(`${JSON.stringify(failure(error))}\n`);
  process.exitCode = exitCodeFor(error.code);
}
