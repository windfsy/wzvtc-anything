import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { argon2id } from 'hash-wasm';

export interface KdfParams {
  memorySize: number;
  iterations: number;
  parallelism: number;
  hashLength: number;
}

export const DEFAULT_KDF: KdfParams = {
  memorySize: 64 * 1024,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
};

export interface WrappedKey {
  nonce: string;
  ciphertext: string;
  tag: string;
}

const DEK_WRAP_AAD = 'wzvtc-vault-dek-v1';

export function randomBytesBase64(length = 32): string {
  return randomBytes(length).toString('base64');
}

export function randomToken(length = 24): string {
  return randomBytes(length).toString('base64url');
}

export async function deriveKek(password: string, saltBase64: string, params: KdfParams): Promise<Buffer> {
  const salt = Buffer.from(saltBase64, 'base64');
  const result = await argon2id({
    password,
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memorySize,
    hashLength: params.hashLength,
    outputType: 'binary',
  });
  return Buffer.from(result);
}

export function aesGcmEncrypt(key: Buffer, plaintext: Buffer, aad?: string): WrappedKey {
  if (key.length !== 32) throw new Error('AES-256-GCM key must be 32 bytes');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    nonce: nonce.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function aesGcmDecrypt(key: Buffer, wrapped: WrappedKey, aad?: string): Buffer {
  if (key.length !== 32) throw new Error('AES-256-GCM key must be 32 bytes');
  const nonce = Buffer.from(wrapped.nonce, 'base64');
  const tag = Buffer.from(wrapped.tag, 'base64');
  const ciphertext = Buffer.from(wrapped.ciphertext, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function wrapKey(key: Buffer, target: Buffer): WrappedKey {
  return aesGcmEncrypt(key, target, DEK_WRAP_AAD);
}

export function unwrapKey(key: Buffer, wrapped: WrappedKey): Buffer {
  return aesGcmDecrypt(key, wrapped, DEK_WRAP_AAD);
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
