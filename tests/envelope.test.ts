import { describe, expect, it } from 'vitest';
import { exitCodeFor, WzvtcError } from '../src/core/errors.js';
import { failure, success } from '../src/core/envelope.js';

describe('JSON envelope', () => {
  it('redacts secrets but keeps confirm tokens', () => {
    const original = {
      access_token: 'secret-access',
      phone: '13800138000',
      confirm_token: 'id.token-value',
      studentId: '20240000001',
      JHRName: 'contact-name',
      OutMoveTel: '13800138000',
      note: 'id 110101199001011234',
      nested: { refreshToken: 'secret-refresh' },
    };
    const result = success(original);
    expect(result.data.access_token).toBe('[REDACTED]');
    expect(result.data.phone).toBe('138****8000');
    expect(result.data.confirm_token).toBe('id.token-value');
    expect(result.data.studentId).toBe('[REDACTED]');
    expect(result.data.JHRName).toBe('[REDACTED]');
    expect(result.data.OutMoveTel).toBe('138****8000');
    expect(result.data.note).toContain('1101**********1234');
    expect(result.data.nested.refreshToken).toBe('[REDACTED]');
    expect(original.access_token).toBe('secret-access');
  });

  it('produces a structured error with a redacted message', () => {
    const error = new WzvtcError('auth_required', 'token=abc123 13800138000', {
      action: {
        type: 'run_command',
        command: 'wzvtc auth import xgxt --channel wechat-mobile',
        message: 'token=abc123',
        requires_user: true,
      },
      details: { access_token: 'secret' },
    });
    const result = failure(error);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('auth_required');
    expect(result.error.message).toContain('[REDACTED]');
    expect(result.error.message).not.toContain('13800138000');
    expect(result.error.action.type).toBe('run_command');
    expect(result.error.details?.access_token).toBe('[REDACTED]');
  });

  it('maps error codes to exit codes', () => {
    expect(exitCodeFor('usage_error')).toBe(2);
    expect(exitCodeFor('auth_required')).toBe(3);
    expect(exitCodeFor('confirmation_required')).toBe(4);
    expect(exitCodeFor('network_error')).toBe(5);
  });
});
