import { constants, publicEncrypt } from 'node:crypto';

// Shared by the WZVTC mobile APIs (xgxt and dekt) as of 2026-10.
export const WZVTC_MOBILE_RSA_PUBLIC_KEY =
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCK4n2xrbtnRyBqMJ2iiDeDRdJ/F8EVmzcjSGy/vVNfEVahl6sQOjQXZTc8AEbiZdyLnP9QwX3ZkIsEGUz1VMaPUJeHLHQC5uVljRWR0ORt4oiU7mtN5ZsEl8gPQBzSbC7IpnXVRN1Mx7s/RlFsWZgkuZKbPjxcfgoA9zXyhmcHywIDAQAB';

export function rsaEncryptPkcs1(publicKeyBase64: string, value: string): string {
  const body = publicKeyBase64.match(/.{1,64}/g)?.join('\n') ?? publicKeyBase64;
  const pem = `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
  return publicEncrypt(
    { key: pem, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(value, 'utf8'),
  ).toString('base64');
}
