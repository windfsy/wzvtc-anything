import type { Command } from 'commander';
import { WzvtcError } from '../../core/errors.js';
import { createPending, hashInput, packConfirmToken } from '../../core/pending.js';
import { sessionFingerprint } from '../../core/session.js';
import type { ProviderSession, Vault } from '../../core/vault/vault.js';
import { DektClient, isActivityFull } from '../../connectors/dekt/client.js';
import { commandAction } from '../command.js';
import { positiveInt } from '../io.js';
import { openVaultOrPrompt } from '../vaultAccess.js';
import { executeConfirmedWrite } from '../write.js';

function getDektSession(vault: Vault): ProviderSession {
  const session = vault.getSession('dekt');
  if (!session) {
    throw new WzvtcError('auth_required', '尚未登录第二课堂', {
      action: {
        type: 'run_command',
        command: 'wzvtc auth login dekt --password-stdin',
        message: '请让用户在自己的终端登录第二课堂',
        requires_user: true,
      },
    });
  }
  return session;
}

function parseStatus(value: string | undefined): number {
  if (value === undefined) return -1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new WzvtcError('invalid_input', `无效的活动状态：${value}`);
  }
  return parsed;
}

async function verifyEnrollment(
  client: DektClient,
  session: ProviderSession,
  activityId: string,
  expectedEnrolled: boolean,
): Promise<unknown> {
  try {
    const enrollment = await client.findEnrollment(session, activityId);
    if (expectedEnrolled) {
      if (enrollment) {
        return { status: 'verified', note: '报名记录已出现在“我已报名”列表' };
      }
      const detail = await client.getActivity(session, activityId);
      return detail.already_enrolled
        ? { status: 'verified', note: '活动详情已显示报名状态' }
        : { status: 'unverified', note: '操作成功但未查到报名记录，请核对' };
    }
    if (!enrollment) {
      const detail = await client.getActivity(session, activityId);
      return !detail.already_enrolled
        ? { status: 'verified', note: '“我已报名”列表与活动详情均已取消' }
        : { status: 'unverified', note: '取消后活动详情仍显示已报名，请核对' };
    }
    return { status: 'unverified', note: '取消后“我已报名”列表仍存在记录，请核对' };
  } catch (error) {
    return {
      status: 'unverified',
      note: `回查失败：${error instanceof WzvtcError ? error.code : 'unknown'}；请手动核对`,
    };
  }
}

export function registerDektCommands(program: Command): void {
  const dekt = program.command('dekt').description('第二课堂（读 + 报名/取消受控写）');

  const activity = dekt.command('activity').description('活动查询');

  activity
    .command('list')
    .description('查询第二课堂活动列表')
    .option('--page <page>', '页码', '1')
    .option('--limit <limit>', '本次最多返回条数', '20')
    .option('--status <status>', '状态：-1 全部，3 我已报名', '-1')
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as { page?: string; limit?: string; status?: string };
        const page = positiveInt(opts.page, 1, 1000);
        const limit = positiveInt(opts.limit, 20, 100);
        const status = parseStatus(opts.status);
        const vault = await openVaultOrPrompt(true);
        const session = getDektSession(vault);
        const result = await new DektClient().listActivities(session, { page, status });
        const items = result.items.slice(0, limit);
        return {
          page,
          status,
          items,
          returned: items.length,
          total_items: result.items.length,
          total_pages: result.totalPages,
          truncated: result.items.length > items.length,
        };
      }),
    );

  activity
    .command('get')
    .description('查询单个第二课堂活动详情')
    .requiredOption('--id <id>', '活动 ID')
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as { id: string };
        const vault = await openVaultOrPrompt(true);
        const session = getDektSession(vault);
        const data = await new DektClient().getActivity(session, opts.id);
        return { id: opts.id, data };
      }),
    );

  activity
    .command('enroll')
    .description('预览或报名第二课堂活动，默认 dry-run')
    .requiredOption('--id <id>', '活动 ID')
    .option('--role <role>', '报名角色 ID 或名称；默认第一个角色')
    .option('--execute', '真实报名', false)
    .option('--confirm <token>', '预览返回的 confirm token')
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as {
          id: string;
          role?: string;
          execute?: boolean;
          confirm?: string;
        };
        const vault = await openVaultOrPrompt(true);
        const session = getDektSession(vault);
        const sessionHash = sessionFingerprint('dekt', session);
        const client = new DektClient();
        const detail = await client.getActivity(session, opts.id);
        if (detail.already_enrolled) {
          throw new WzvtcError('precondition_failed', '你已经报名过该活动');
        }
        if (detail.status && !detail.status.includes('可报名')) {
          throw new WzvtcError('precondition_failed', '活动当前不可报名', {
            details: { status: detail.status },
          });
        }
        if (isActivityFull(detail.capacity)) {
          throw new WzvtcError('precondition_failed', '活动名额已满', {
            details: { capacity: detail.capacity },
          });
        }
        const role = opts.role
          ? detail.roles.find((entry) => entry.value === opts.role || entry.text === opts.role)
          : detail.roles[0];
        if (!role) {
          throw new WzvtcError('invalid_input', '找不到可用的报名角色', {
            details: { available_roles: detail.roles.map((entry) => entry.text) },
          });
        }

        const summary = {
          activity_id: detail.id,
          activity_name: detail.name,
          role: role.text,
          time: detail.time,
          place: detail.place,
        };
        const inputHash = hashInput({
          tool: 'dekt.activity.enroll',
          activityId: opts.id,
          roleId: role.value,
        });

        if (!opts.execute) {
          const pending = createPending('dekt.activity.enroll', inputHash, summary, {
            sessionHash,
          });
          return {
            executed: false,
            ready_to_submit: true,
            preview: summary,
            confirm_token: packConfirmToken(pending.id, pending.token),
            expires_at: pending.expiresAt,
          };
        }

        if (!opts.confirm) {
          throw new WzvtcError('confirmation_required', '真实报名需要 confirm token', {
            action: {
              type: 'ask_user',
              message: '先预览并取得用户确认，再用 --execute --confirm <token>',
              requires_user: true,
            },
          });
        }

        return executeConfirmedWrite({
          tool: 'dekt.activity.enroll',
          inputHash,
          sessionHash,
          confirm: opts.confirm,
          summary,
          execute: () =>
            client.enroll(session, {
              activityId: opts.id,
              roleId: role.value,
              roleText: role.text,
            }),
          verify: () => verifyEnrollment(client, session, opts.id, true),
        });
      }),
    );

  activity
    .command('cancel')
    .description('预览或取消第二课堂报名，默认 dry-run')
    .requiredOption('--id <id>', '活动 ID')
    .option('--enrollment-id <id>', '报名记录 Iid；省略时自动查找')
    .option('--execute', '真实取消', false)
    .option('--confirm <token>', '预览返回的 confirm token')
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as {
          id: string;
          enrollmentId?: string;
          execute?: boolean;
          confirm?: string;
        };
        const vault = await openVaultOrPrompt(true);
        const session = getDektSession(vault);
        const sessionHash = sessionFingerprint('dekt', session);
        const client = new DektClient();
        let enrollmentId = opts.enrollmentId;
        let activityName = '';
        if (!enrollmentId) {
          const enrollment = await client.findEnrollment(session, opts.id);
          if (enrollment?.enrollment_id) {
            enrollmentId = enrollment.enrollment_id;
            activityName = enrollment.name;
          } else {
            const detail = await client.getActivity(session, opts.id);
            if (detail.already_enrolled && detail.enrollment_id) {
              enrollmentId = detail.enrollment_id;
              activityName = detail.name;
            } else {
              throw new WzvtcError('precondition_failed', '未找到该活动的报名记录', {
                action: {
                  type: 'ask_user',
                  message:
                    '先运行 wzvtc dekt activity list --status 3 核对；仍找不到时在官方 App 中取消',
                  requires_user: true,
                },
              });
            }
          }
        }

        const summary = {
          activity_id: opts.id,
          enrollment_id: enrollmentId,
          ...(activityName ? { activity_name: activityName } : {}),
        };
        const inputHash = hashInput({
          tool: 'dekt.activity.cancel',
          activityId: opts.id,
          enrollmentId,
        });

        if (!opts.execute) {
          const pending = createPending('dekt.activity.cancel', inputHash, summary, {
            sessionHash,
          });
          return {
            executed: false,
            ready_to_submit: true,
            preview: summary,
            confirm_token: packConfirmToken(pending.id, pending.token),
            expires_at: pending.expiresAt,
          };
        }

        if (!opts.confirm) {
          throw new WzvtcError('confirmation_required', '真实取消需要 confirm token', {
            action: {
              type: 'ask_user',
              message: '先预览并取得用户确认，再用 --execute --confirm <token>',
              requires_user: true,
            },
          });
        }

        return executeConfirmedWrite({
          tool: 'dekt.activity.cancel',
          inputHash,
          sessionHash,
          confirm: opts.confirm,
          summary,
          execute: () => client.cancel(session, enrollmentId!),
          verify: () => verifyEnrollment(client, session, opts.id, false),
        });
      }),
    );

  const transcript = dekt.command('transcript').description('二课成绩单');

  transcript
    .command('get')
    .description('查询二课成绩单与总学时')
    .option('--page <page>', '页码', '1')
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as { page?: string };
        const page = positiveInt(opts.page, 1, 100);
        const vault = await openVaultOrPrompt(true);
        const session = getDektSession(vault);
        return new DektClient().getTranscript(session, page);
      }),
    );
}
