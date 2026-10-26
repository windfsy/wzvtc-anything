import { WzvtcError } from '../core/errors.js';
import { readSecret } from '../core/secret.js';
import { OsKeychain } from '../core/vault/keychain.js';
import { Vault } from '../core/vault/vault.js';

export function createVault(): Vault {
  return new Vault({ keychain: new OsKeychain() });
}

export async function openVaultOrPrompt(allowPrompt = true): Promise<Vault> {
  const vault = createVault();
  if (!vault.exists()) {
    throw new WzvtcError('vault_not_initialized', 'Vault 尚未初始化', {
      action: {
        type: 'run_command',
        command: 'wzvtc vault init',
        message: '请先在终端初始化 Vault',
        requires_user: true,
      },
    });
  }

  try {
    await vault.open();
    return vault;
  } catch (error) {
    if (!(error instanceof WzvtcError) || error.code !== 'master_password_required') {
      throw error;
    }
    if (!allowPrompt || !process.stdin.isTTY) throw error;
    const password = await readSecret('Vault 主密码: ');
    await vault.openWithMasterPassword(password);
    return vault;
  }
}
