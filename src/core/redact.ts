import { isPlainObject } from './json.js';

const SECRET_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /credential/i,
  /captcha/i,
  /student_?id/i,
  /id_?card/i,
  /^(jhrname|outname|realname|real_name)$/i,
  /^(openid|auth_code|link_code)$/i,
];

const PHONE_KEY_PATTERNS = [/phone/i, /mobile/i, /tel/i, /telephone/i];

function isSecretKey(key: string): boolean {
  if (key === 'confirm_token') return false;
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function isPhoneKey(key: string): boolean {
  return PHONE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function maskPhone(value: string): string {
  return value.replace(/\b(1[3-9]\d)\d{4}(\d{4})\b/g, '$1****$2');
}

export function redactText(value: string): string {
  let output = value;
  output = output.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]');
  output = output.replace(
    /([?&](?:openid|code|token|access_token|refresh_token|ticket)=)[^&\s]+/gi,
    '$1[REDACTED]',
  );
  output = output.replace(
    /\b(password|passwd|openid|code|token|access_token|refresh_token|ticket)=([^\s&,;]+)/gi,
    '$1=[REDACTED]',
  );
  output = maskPhone(output);
  output = output.replace(/\b\d{17}[\dXx]\b/g, (value) => `${value.slice(0, 4)}**********${value.slice(-4)}`);
  return output;
}

export function redactObject<T>(value: T, key = ''): T {
  if (typeof value === 'string') {
    if (isSecretKey(key)) return '[REDACTED]' as T;
    return (isPhoneKey(key) ? maskPhone(value) : redactText(value)) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item, key)) as T;
  }
  if (isPlainObject(value)) {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      if (isSecretKey(childKey)) {
        output[childKey] = '[REDACTED]';
      } else {
        output[childKey] = redactObject(childValue, childKey);
      }
    }
    return output as T;
  }
  return value;
}
