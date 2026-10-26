import type { Command } from 'commander';
import { WzvtcError } from '../../core/errors.js';
import { readAllInput, readLine, readSecret } from '../../core/secret.js';
import { DektClient } from '../../connectors/dekt/client.js';
import { XgxtClient } from '../../connectors/xgxt/client.js';
import { parseXgxtLink } from '../../connectors/xgxt/linkCode.js';
import { ZyhClient } from '../../connectors/zyh/client.js';
import { commandAction } from '../command.js';
import { openVaultOrPrompt } from '../vaultAccess.js';

async function readLinkFromUser(): Promise<string> {
  if (process.stdin.isTTY) {
    return readSecret('粘贴微信学工链接（输入隐藏，不会回显）: ');
  }
  return readAllInput();
}

async function readCredentials(passwordStdin: boolean): Promise<{ username: string; password: string }> {
  if (passwordStdin) {
    const input = await readAllInput();
    const lines = input.split(/\r?\n/);
    const username = (lines[0] ?? '').trim();
    const password = (lines[1] ?? '').trim();
    if (!username || !password) {
      throw new WzvtcError('invalid_input', 'stdin 需要两行：账号、密码', {
        action: {
          type: 'ask_user',
          message: '使用 printf "账号\\n密码\\n" | wzvtc auth login xgxt --password-stdin',
          requires_user: true,
        },
      });
    }
    return { username, password };
  }
  if (!process.stdin.isTTY) {
    throw new WzvtcError('master_password_required', '非交互环境无法隐藏输入学工密码', {
      action: {
        type: 'ask_user',
        message: '请在终端运行，或使用 --password-stdin 从受控管道读取',
        requires_user: true,
      },
    });
  }
  const username = (await readLine('账号: ')).trim();
  const password = await readSecret('密码（输入隐藏）: ');
  if (!username || !password) {
    throw new WzvtcError('invalid_input', '账号或密码为空');
  }
  return { username, password };
}

function normalizeChannel(channel: string): string {
  const normalized = channel === 'wechat' ? 'wechat-mobile' : channel;
  if (normalized !== 'wechat-mobile') {
    throw new WzvtcError('unsupported_channel', `不支持的学工渠道：${channel}`);
  }
  return normalized;
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('登录与导入校园凭证');

  auth
    .command('import <provider>')
    .description('从微信链接导入学工 token')
    .option('--channel <channel>', '认证渠道', 'wechat-mobile')
    .action(
      commandAction(async (provider: unknown, options: unknown) => {
        const providerName = String(provider);
        if (providerName !== 'xgxt') {
          throw new WzvtcError('unsupported_feature', `暂不支持 ${providerName} 的链接导入`, {
            action: {
              type: 'ask_user',
              message: 'v1 目前只支持 wzvtc auth import xgxt',
              requires_user: true,
            },
          });
        }
        const opts = options as { channel?: string };
        const channel = normalizeChannel(opts.channel ?? 'wechat-mobile');
        const link = (await readLinkFromUser()).trim();
        if (!link) {
          throw new WzvtcError('invalid_input', '没有读取到学工链接', {
            action: {
              type: 'ask_user',
              message: '请在自己的终端重新运行，并粘贴微信学工链接',
              requires_user: true,
            },
          });
        }
        const parsed = parseXgxtLink(link);
        const vault = await openVaultOrPrompt(true);
        const client = new XgxtClient();
        const session = await client.exchangeLinkCode(parsed.code, parsed.host);
        vault.saveSession('xgxt', session);
        return {
          provider: 'xgxt',
          channel,
          authenticated: true,
          vault: 'saved',
          host: parsed.host,
          warnings: ['该学工链接实测可重复导入，请按密码等价物处理；不要分享、截图或记录'],
        };
      }),
    );

  auth
    .command('login <provider>')
    .description('账号密码登录（xgxt/dekt/zyh）；只存 token，不保存密码')
    .option('--password-stdin', '从 stdin 读取两行：账号、密码（人工使用）', false)
    .action(
      commandAction(async (provider: unknown, options: unknown) => {
        const providerName = String(provider);
        if (!['xgxt', 'dekt', 'zyh'].includes(providerName)) {
          throw new WzvtcError('unsupported_feature', `暂不支持 ${providerName} 的账号密码登录`);
        }
        const opts = options as { passwordStdin?: boolean };
        const vault = await openVaultOrPrompt(true);
        const credentials = await readCredentials(Boolean(opts.passwordStdin));
        let session;
        if (providerName === 'xgxt') {
          session = await new XgxtClient().loginWithPassword(
            credentials.username,
            credentials.password,
          );
        } else if (providerName === 'dekt') {
          session = await new DektClient().loginWithPassword(
            credentials.username,
            credentials.password,
          );
        } else {
          session = await new ZyhClient().loginWithPassword(
            credentials.username,
            credentials.password,
          );
        }
        vault.saveSession(providerName, session);
        return {
          provider: providerName,
          authenticated: true,
          method: 'password',
          vault: 'saved',
        };
      }),
    );

  auth
    .command('status [provider]')
    .description('查看登录态（xgxt/dekt/zyh）')
    .option('--probe', '调用对应接口验证 token', false)
    .action(
      commandAction(async (provider: unknown, options: unknown) => {
        const providerName = provider ? String(provider) : 'xgxt';
        if (!['xgxt', 'dekt', 'zyh'].includes(providerName)) {
          throw new WzvtcError('unsupported_feature', `暂不支持 ${providerName} 的状态检查`);
        }
        const opts = options as { probe?: boolean };
        const vault = await openVaultOrPrompt(true);
        const session = vault.getSession(providerName);
        if (!session) {
          return { provider: providerName, sessionPresent: false, authenticated: false };
        }
        if (!opts.probe) {
          return {
            provider: providerName,
            sessionPresent: true,
            authenticated: 'unverified',
            obtainedAt: session.obtainedAt,
          };
        }
        try {
          if (providerName === 'xgxt') await new XgxtClient().probe(session);
          else if (providerName === 'dekt') await new DektClient().probe(session);
          else await new ZyhClient().probe(session);
          return {
            provider: providerName,
            sessionPresent: true,
            authenticated: true,
            obtainedAt: session.obtainedAt,
          };
        } catch (error) {
          const code = error instanceof WzvtcError ? error.code : 'unknown';
          return {
            provider: providerName,
            sessionPresent: true,
            authenticated: code === 'auth_expired' ? false : null,
            probeError: code,
            obtainedAt: session.obtainedAt,
          };
        }
      }),
    );
}
