import type { Command } from 'commander';
import { WzvtcError } from '../../core/errors.js';
import { getDataDir } from '../../core/paths.js';
import { confirm, readAllInput, readLine, readSecret } from '../../core/secret.js';
import { OsKeychain } from '../../core/vault/keychain.js';
import { commandAction } from '../command.js';
import { createVault, openVaultOrPrompt } from '../vaultAccess.js';

async function readInitPassword(passwordStdin: boolean): Promise<string> {
  if (passwordStdin) {
    const input = await readAllInput();
    return input.replace(/\r?\n$/, '');
  }
  if (!process.stdin.isTTY) {
    throw new WzvtcError('master_password_required', '非交互环境无法隐藏输入主密码', {
      action: {
        type: 'ask_user',
        message: '请在终端运行 wzvtc vault init，或使用 --password-stdin',
        requires_user: true,
      },
    });
  }
  const first = await readSecret('设置 Vault 主密码（至少 8 位）: ');
  const second = await readSecret('再次输入主密码: ');
  if (first !== second) {
    throw new WzvtcError('invalid_input', '两次输入的主密码不一致');
  }
  return first;
}

export function registerVaultCommands(program: Command): void {
  const vault = program.command('vault').description('管理本地加密 Vault');

  vault
    .command('init')
    .description('初始化 Vault 与主密码')
    .option('--trust-device', '生成设备密钥并写入系统钥匙串', false)
    .option('--password-stdin', '从 stdin 读取主密码（仅供受控人工脚本）', false)
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as { trustDevice?: boolean; passwordStdin?: boolean };
        const instance = createVault();
        if (instance.exists()) {
          throw new WzvtcError('precondition_failed', 'Vault 已存在');
        }
        const password = await readInitPassword(Boolean(opts.passwordStdin));
        const trustDevice = opts.trustDevice
          ? true
          : process.stdin.isTTY
            ? await confirm('信任此设备？之后无需重复输入主密码', true)
            : false;
        const result = await instance.init(password, trustDevice);
        return {
          initialized: true,
          dataDir: getDataDir(),
          trustedDevice: result.trustedDevice,
          status: instance.status(),
        };
      }),
    );

  vault
    .command('status')
    .description('查看 Vault 状态，不返回明文')
    .action(
      commandAction(async () => {
        const instance = createVault();
        return {
          dataDir: getDataDir(),
          keychainAvailable: new OsKeychain().isAvailable(),
          ...instance.status(),
        };
      }),
    );

  vault
    .command('list')
    .description('列出 Vault 条目元数据')
    .action(
      commandAction(async () => {
        const instance = await openVaultOrPrompt(true);
        return { items: instance.listItems() };
      }),
    );

  vault
    .command('devices')
    .description('列出已信任设备')
    .action(
      commandAction(async () => {
        const instance = await openVaultOrPrompt(true);
        return { devices: instance.listDevices() };
      }),
    );

  vault
    .command('trust-device')
    .description('信任当前设备，把设备密钥写入系统钥匙串')
    .action(
      commandAction(async () => {
        const instance = await openVaultOrPrompt(true);
        await instance.trustCurrentDevice();
        return { trusted: true, devices: instance.listDevices() };
      }),
    );

  vault
    .command('revoke-device <deviceId>')
    .description('撤销指定设备的钥匙串信任；当前设备被撤销后需主密码解锁')
    .option('--yes', '跳过交互确认', false)
    .action(
      commandAction(async (deviceId: unknown, options: unknown) => {
        const opts = options as { yes?: boolean };
        const instance = createVault();
        if (!instance.exists()) {
          throw new WzvtcError('vault_not_initialized', 'Vault 尚未初始化');
        }
        if (!opts.yes) {
          if (!process.stdin.isTTY) {
            throw new WzvtcError('confirmation_required', '撤销设备信任需要 --yes 或终端确认');
          }
          if (!(await confirm(`确认撤销设备 ${String(deviceId)} 的信任？`, false))) {
            return { revoked: false, cancelled: true };
          }
        }
        const result = instance.revokeDevice(String(deviceId));
        if (!result.revoked) {
          throw new WzvtcError('not_found', '设备不存在');
        }
        return {
          revoked: true,
          current: result.current,
          devices: instance.listDevices(),
        };
      }),
    );

  vault
    .command('reset')
    .description('删除 Vault、会话、pending、operations、日志、缓存与设备信任')
    .option('--purge', '确认删除全部本地数据', false)
    .option('--confirm <word>', '非交互确认：必须为 RESET')
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as { purge?: boolean; confirm?: string };
        if (!opts.purge) {
          throw new WzvtcError('usage_error', '仅支持 vault reset --purge');
        }
        let confirmation = opts.confirm;
        if (!confirmation) {
          if (!process.stdin.isTTY) {
            throw new WzvtcError('confirmation_required', '非交互环境需要 --confirm RESET');
          }
          confirmation = await readLine('输入 RESET 确认删除全部本地数据: ');
        }
        if (confirmation !== 'RESET') {
          throw new WzvtcError('confirmation_required', '确认词不正确，未删除任何数据');
        }
        const result = createVault().resetPurge();
        return {
          reset: true,
          removedDevices: result.removedDevices,
          dataDir: getDataDir(),
        };
      }),
    );
}
