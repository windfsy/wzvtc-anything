import { sha256Hex } from './vault/crypto.js';
import type { ProviderSession } from './vault/vault.js';

export function sessionFingerprint(provider: string, session: ProviderSession): string {
  return sha256Hex(
    `${provider}\u0000${session.baseUrl}\u0000${session.userId ?? ''}\u0000${session.accessToken}`,
  );
}
