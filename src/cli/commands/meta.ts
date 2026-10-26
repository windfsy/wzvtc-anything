import type { Command } from 'commander';
import { CLI_VERSION, SCHEMA_VERSION } from '../../core/version.js';
import { filterSchema } from '../../core/schema.js';
import { getDataDir } from '../../core/paths.js';
import { bundledSkillDir, skillExists } from '../../core/skills.js';
import { OsKeychain } from '../../core/vault/keychain.js';
import { Vault } from '../../core/vault/vault.js';
import { XgxtClient } from '../../connectors/xgxt/client.js';
import { DektClient } from '../../connectors/dekt/client.js';
import { ZyhClient } from '../../connectors/zyh/client.js';
import { WzvtcError } from '../../core/errors.js';
import { commandAction } from '../command.js';

type ProviderName = 'xgxt' | 'dekt' | 'zyh';

interface ProviderStatus {
  sessionPresent: boolean | 'locked';
  authenticated: boolean | null;
  probeError?: string;
}

async function doctor(probe: boolean): Promise<unknown> {
  const keychain = new OsKeychain();
  const vault = new Vault({ keychain });
  const status = vault.status();

  const providers: Record<ProviderName, ProviderStatus> = {
    xgxt: { sessionPresent: 'locked', authenticated: null },
    dekt: { sessionPresent: 'locked', authenticated: null },
    zyh: { sessionPresent: 'locked', authenticated: null },
  };
  let deviceUnlockError: string | undefined;

  if (status.initialized && status.deviceTrusted) {
    try {
      await vault.open();
      for (const provider of ['xgxt', 'dekt', 'zyh'] as const) {
        const session = vault.getSession(provider);
        providers[provider].sessionPresent = Boolean(session);
        if (probe && session) {
          try {
            if (provider === 'xgxt') await new XgxtClient().probe(session);
            else if (provider === 'dekt') await new DektClient().probe(session);
            else await new ZyhClient().probe(session);
            providers[provider].authenticated = true;
          } catch (error) {
            const code = error instanceof WzvtcError ? error.code : 'unknown';
            providers[provider].authenticated = code === 'auth_expired' ? false : null;
            providers[provider].probeError = code;
          }
        }
      }
    } catch (error) {
      deviceUnlockError = error instanceof WzvtcError ? error.code : 'unknown';
      for (const provider of ['xgxt', 'dekt', 'zyh'] as const) {
        providers[provider].sessionPresent = 'locked';
      }
    }
  }

  const anySession = Object.values(providers).some((provider) => provider.sessionPresent === true);
  const healthy = status.initialized && status.deviceTrusted && anySession && !deviceUnlockError;
  return {
    node: process.version,
    platform: process.platform,
    dataDir: getDataDir(),
    keychain: { available: keychain.isAvailable() },
    vault: { ...status, deviceUnlockError },
    xgxt: providers.xgxt,
    dekt: providers.dekt,
    zyh: providers.zyh,
    skill: { bundled: skillExists(), path: bundledSkillDir() },
    healthy,
  };
}

export function registerMetaCommands(program: Command): void {
  program
    .command('version')
    .description('输出版本与运行环境')
    .action(
      commandAction(async () => ({
        name: 'wzvtc',
        version: CLI_VERSION,
        schema_version: SCHEMA_VERSION,
        node: process.version,
        platform: process.platform,
      })),
    );

  program
    .command('doctor')
    .description('检查 Vault、钥匙串、登录态与运行环境')
    .option('--probe', '同时探测已登录的 provider 接口', false)
    .action(
      commandAction(async (options: unknown) => {
        const probe = Boolean((options as { probe?: boolean }).probe);
        return doctor(probe);
      }),
    );

  program
    .command('schema [command]')
    .description('输出机器可读的命令目录')
    .option('--compact', '只输出命令名/路径/风险/认证', false)
    .action(
      commandAction(async (command: unknown, options: unknown) => {
        const compact = Boolean((options as { compact?: boolean }).compact);
        return filterSchema(compact, command ? String(command) : undefined);
      }),
    );
}
