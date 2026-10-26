import { asWzvtcError } from '../core/errors.js';
import { emitError, emitOk } from '../core/envelope.js';

export function commandAction(
  fn: (...args: unknown[]) => Promise<unknown>,
): (...args: unknown[]) => Promise<void> {
  return async (...args: unknown[]) => {
    try {
      const data = await fn(...args);
      emitOk(data ?? {});
    } catch (error) {
      emitError(asWzvtcError(error));
    }
  };
}
