import { WzvtcError } from './errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertSafeId(value: string, label = 'id'): string {
  if (!UUID_PATTERN.test(value)) {
    throw new WzvtcError('invalid_input', `非法 ${label}`);
  }
  return value;
}
