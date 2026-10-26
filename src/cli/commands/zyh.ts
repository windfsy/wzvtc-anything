import type { Command } from 'commander';
import { WzvtcError } from '../../core/errors.js';
import type { ProviderSession, Vault } from '../../core/vault/vault.js';
import { ZyhClient } from '../../connectors/zyh/client.js';
import { commandAction } from '../command.js';
import { positiveInt } from '../io.js';
import { openVaultOrPrompt } from '../vaultAccess.js';

function getZyhSession(vault: Vault): ProviderSession {
  const session = vault.getSession('zyh');
  if (!session) {
    throw new WzvtcError('auth_required', '尚未登录志愿汇', {
      action: {
        type: 'run_command',
        command: 'wzvtc auth login zyh --password-stdin',
        message: '请让用户在自己的终端登录志愿汇',
        requires_user: true,
      },
    });
  }
  return session;
}

function parseYear(value: string | undefined): number {
  const year = value ? Number.parseInt(value, 10) : new Date().getFullYear();
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    throw new WzvtcError('invalid_input', `无效年份：${value}`);
  }
  return year;
}

export function registerZyhCommands(program: Command): void {
  const zyh = program.command('zyh').description('志愿汇（当前只读）');
  const hours = zyh.command('hours').description('志愿时长');

  hours
    .command('summary')
    .description('查询志愿时长汇总')
    .action(
      commandAction(async () => {
        const vault = await openVaultOrPrompt(true);
        const session = getZyhSession(vault);
        return { provider: 'zyh', ...(await new ZyhClient().summary(session)) };
      }),
    );

  hours
    .command('list')
    .description('查询志愿时长明细')
    .option('--year <year>', '年份，默认当前年')
    .option('--page <page>', '页码', '1')
    .option('--limit <limit>', '本次条数', '20')
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as { year?: string; page?: string; limit?: string };
        const year = parseYear(opts.year);
        const page = positiveInt(opts.page, 1, 1000);
        const limit = positiveInt(opts.limit, 20, 100);
        const vault = await openVaultOrPrompt(true);
        const session = getZyhSession(vault);
        const result = await new ZyhClient().hours(session, { year, page, rows: limit });
        return { provider: 'zyh', year, ...result, returned: result.items.length };
      }),
    );
}
