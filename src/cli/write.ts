import { WzvtcError } from '../core/errors.js';
import { isPlainObject } from '../core/json.js';
import { createOperation, updateOperation } from '../core/operations.js';
import { consumePending, unpackConfirmToken } from '../core/pending.js';

export interface WriteResponse {
  ok: boolean;
  status: number;
  failureMessage?: string;
  unknown?: boolean;
}

export interface ConfirmedWriteOptions {
  tool: string;
  inputHash: string;
  sessionHash: string;
  confirm: string;
  summary: unknown;
  execute: () => Promise<WriteResponse>;
  verify: () => Promise<unknown>;
}

export async function executeConfirmedWrite(options: ConfirmedWriteOptions): Promise<unknown> {
  const { id: pendingId, token } = unpackConfirmToken(options.confirm);
  const record = consumePending(pendingId, token);
  if (
    record.tool !== options.tool ||
    record.inputHash !== options.inputHash ||
    record.sessionHash !== options.sessionHash
  ) {
    throw new WzvtcError('confirmation_expired', '确认内容与当前账号或输入不一致，请重新预览', {
      action: { type: 'ask_user', message: '请重新预览后再确认', requires_user: true },
      details: { reason: 'input_or_session_mismatch' },
    });
  }

  const operation = createOperation(options.tool, options.inputHash, options.sessionHash);
  let response: WriteResponse;
  try {
    response = await options.execute();
  } catch (error) {
    const code = error instanceof WzvtcError ? error.code : 'internal_error';
    updateOperation(operation.id, { status: 'unknown', errorCode: code });
    if (error instanceof WzvtcError && error.code === 'network_error') {
      throw new WzvtcError('network_error', error.message, {
        action: {
          type: 'wait',
          message: '请求结果未知，先运行 wzvtc operations get 或重新读取上游状态，再决定是否重试',
        },
        retryable: true,
        sideEffectPossible: true,
        cause: error,
        details: error.details,
      });
    }
    throw error;
  }

  if (response.unknown) {
    updateOperation(operation.id, { status: 'unknown', errorCode: 'network_error' });
    throw new WzvtcError('network_error', '无法确认写操作是否已生效', {
      action: {
        type: 'wait',
        message: '先运行 wzvtc operations get 或重新读取上游状态，核对后再决定是否重试',
      },
      sideEffectPossible: true,
      details: { status: response.status },
    });
  }

  if (!response.ok) {
    updateOperation(operation.id, { status: 'failed', errorCode: 'precondition_failed' });
    throw new WzvtcError('precondition_failed', response.failureMessage ?? '上游拒绝了本次操作', {
      action: {
        type: 'ask_user',
        message: '先查看最新状态；不要盲目重试',
        requires_user: true,
      },
      details: { status: response.status },
    });
  }

  updateOperation(operation.id, { status: 'submitted' });
  const verification = await options.verify();
  const verificationStatus =
    isPlainObject(verification) && verification.status === 'verified' ? 'verified' : 'submitted';
  updateOperation(operation.id, { status: verificationStatus, verification });
  return {
    executed: true,
    operation_id: operation.id,
    preview: options.summary,
    verification,
    upstream_status: response.status,
  };
}
