import { Entry } from '@napi-rs/keyring';

export interface Keychain {
  get(account: string): string | null;
  set(account: string, secret: string): void;
  delete(account: string): void;
  isAvailable(): boolean;
}

export class OsKeychain implements Keychain {
  constructor(private readonly service = 'wzvtc-anything') {}

  get(account: string): string | null {
    try {
      return new Entry(this.service, account).getPassword() ?? null;
    } catch {
      return null;
    }
  }

  set(account: string, secret: string): void {
    new Entry(this.service, account).setPassword(secret);
  }

  delete(account: string): void {
    try {
      new Entry(this.service, account).deletePassword();
    } catch {
      // Deleting a missing keychain entry is a no-op.
    }
  }

  isAvailable(): boolean {
    try {
      new Entry(this.service, '__availability_probe__').getPassword();
      return true;
    } catch {
      return false;
    }
  }
}

export class MemoryKeychain implements Keychain {
  private readonly values = new Map<string, string>();

  constructor(private readonly service = 'wzvtc-anything') {}

  private key(account: string): string {
    return `${this.service}:${account}`;
  }

  get(account: string): string | null {
    return this.values.get(this.key(account)) ?? null;
  }

  set(account: string, secret: string): void {
    this.values.set(this.key(account), secret);
  }

  delete(account: string): void {
    this.values.delete(this.key(account));
  }

  isAvailable(): boolean {
    return true;
  }
}
