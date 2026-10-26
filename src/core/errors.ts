export type ErrorCode =
  | 'usage_error'
  | 'invalid_input'
  | 'auth_required'
  | 'auth_expired'
  | 'vault_locked'
  | 'vault_not_initialized'
  | 'master_password_required'
  | 'master_password_invalid'
  | 'keychain_unavailable'
  | 'link_code_expired'
  | 'confirmation_required'
  | 'confirmation_expired'
  | 'precondition_failed'
  | 'rate_limited'
  | 'upstream_changed'
  | 'network_error'
  | 'unsupported_channel'
  | 'unsupported_feature'
  | 'session_conflict'
  | 'verification_failed'
  | 'vault_corrupt'
  | 'not_found'
  | 'upstream_blocked'
  | 'internal_error';

export type ActionType = 'run_command' | 'ask_user' | 'reauth' | 'wait' | 'none';

export interface AgentAction {
  type: ActionType;
  message: string;
  command?: string;
  requires_user?: boolean;
}

export interface WzvtcErrorOptions {
  action?: AgentAction;
  retryable?: boolean;
  sideEffectPossible?: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class WzvtcError extends Error {
  readonly code: ErrorCode;
  readonly action: AgentAction;
  readonly retryable: boolean;
  readonly sideEffectPossible: boolean;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, options: WzvtcErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'WzvtcError';
    this.code = code;
    this.action = options.action ?? { type: 'none', message };
    this.retryable = options.retryable ?? false;
    this.sideEffectPossible = options.sideEffectPossible ?? false;
    this.details = options.details;
  }
}

export const EXIT_CODE_BY_ERROR: Record<ErrorCode, number> = {
  usage_error: 2,
  invalid_input: 2,
  auth_required: 3,
  auth_expired: 3,
  vault_locked: 3,
  vault_not_initialized: 3,
  master_password_required: 3,
  master_password_invalid: 3,
  keychain_unavailable: 3,
  link_code_expired: 3,
  confirmation_required: 4,
  confirmation_expired: 4,
  precondition_failed: 1,
  rate_limited: 5,
  upstream_changed: 1,
  network_error: 5,
  unsupported_channel: 1,
  unsupported_feature: 1,
  session_conflict: 3,
  verification_failed: 1,
  vault_corrupt: 1,
  not_found: 1,
  upstream_blocked: 1,
  internal_error: 1,
};

export function exitCodeFor(code: ErrorCode): number {
  return EXIT_CODE_BY_ERROR[code] ?? 1;
}

export function asWzvtcError(error: unknown): WzvtcError {
  if (error instanceof WzvtcError) return error;
  if (error instanceof Error) {
    return new WzvtcError('internal_error', error.message, { cause: error });
  }
  return new WzvtcError('internal_error', String(error));
}
