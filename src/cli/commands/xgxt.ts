import type { Command } from 'commander';
import { WzvtcError } from '../../core/errors.js';
import { deepMerge, isPlainObject } from '../../core/json.js';
import { sessionFingerprint } from '../../core/session.js';
import { createPending, hashInput, packConfirmToken } from '../../core/pending.js';
import type { Vault, XgxtSession } from '../../core/vault/vault.js';
import { XgxtClient } from '../../connectors/xgxt/client.js';
import {
  applyLeaveCalculations,
  stableLeaveInfoForHash,
  summarizeLeaveItem,
  validateLeaveInfo,
} from '../../connectors/xgxt/leaveForm.js';
import { commandAction } from '../command.js';
import { positiveInt, readJsonInput } from '../io.js';
import { openVaultOrPrompt } from '../vaultAccess.js';
import { executeConfirmedWrite } from '../write.js';

function getSession(vault: Vault): XgxtSession {
  const session = vault.getSession('xgxt');
  if (!session) {
    throw new WzvtcError('auth_required', '尚未登录学工系统', {
      action: {
        type: 'run_command',
        command: 'wzvtc auth import xgxt --channel wechat-mobile',
        message: '请让用户在自己的终端导入学工链接',
        requires_user: true,
      },
    });
  }
  return session;
}

function summarizeLeave(info: Record<string, unknown>): Record<string, unknown> {
  return {
    leave_type: info.LeaveTypeTwoText ?? info.LeaveTypeText ?? info.LeaveType,
    begin: info.LeaveBeginDate,
    end: info.LeaveEndDate,
    reason: info.LeaveThing,
    address: info.OutAddress,
    days: info.LeaveDay,
    hours: info.LeaveHour,
  };
}

function summaryForPending(summary: Record<string, unknown>): Record<string, unknown> {
  return {
    leave_type: summary.leave_type,
    begin: summary.begin,
    end: summary.end,
    days: summary.days,
    hours: summary.hours,
  };
}

async function prepareApplyInfo(
  client: XgxtClient,
  session: XgxtSession,
  input: Record<string, unknown>,
): Promise<{ info: Record<string, unknown>; templateKeys: string[] }> {
  const template = await client.leaveInfo(session, '');
  const base = isPlainObject(template.Info) ? template.Info : {};
  const patch = isPlainObject(input.Info) ? input.Info : input;
  const merged = deepMerge(base, patch);
  if (!isPlainObject(merged)) {
    throw new WzvtcError('invalid_input', '请假表单必须是 JSON 对象');
  }
  return { info: merged, templateKeys: Object.keys(template) };
}

async function verifyApplied(
  client: XgxtClient,
  session: XgxtSession,
  info: Record<string, unknown>,
): Promise<{ status: 'verified' | 'unverified'; note: string; record_id?: string }> {
  try {
    const list = await client.listLeaves(session, 1);
    const needles = [info.LeaveThing, info.LeaveBeginDate, info.LeaveEndDate]
      .filter((value) => value !== undefined && value !== null && String(value).length > 0)
      .map(String);
    if (needles.length === 0) {
      return { status: 'unverified', note: '没有可用于匹配的字段，请手动核对请假列表' };
    }
    const matchedItem = list.items.find((item) => {
      const text = JSON.stringify(item);
      return needles.some((needle) => text.includes(needle));
    });
    if (!matchedItem) {
      return { status: 'unverified', note: '提交成功但列表未匹配到记录，请手动核对' };
    }
    const recordId = isPlainObject(matchedItem) && matchedItem.Id ? String(matchedItem.Id) : undefined;
    return {
      status: 'verified',
      note: '请假列表已出现匹配记录',
      ...(recordId ? { record_id: recordId } : {}),
    };
  } catch (error) {
    return {
      status: 'unverified',
      note: `提交后回查失败：${error instanceof WzvtcError ? error.code : 'unknown'}；请手动核对`,
    };
  }
}

export function registerXgxtCommands(program: Command): void {
  const xgxt = program.command('xgxt').description('学工系统');
  const leave = xgxt.command('leave').description('学工请假');

  leave
    .command('list')
    .description('查询请假列表')
    .option('--page <page>', '页码', '1')
    .option('--limit <limit>', '本次最多返回条数', '20')
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as { page?: string; limit?: string };
        const page = positiveInt(opts.page, 1, 1000);
        const limit = positiveInt(opts.limit, 20, 100);
        const vault = await openVaultOrPrompt(true);
        const session = getSession(vault);
        const result = await new XgxtClient().listLeaves(session, page);
        const items = result.items.map(summarizeLeaveItem).slice(0, limit);
        return {
          page,
          items,
          returned: items.length,
          total_items: result.items.length,
          total_pages: result.totalPages,
          is_apply: result.isApply,
          raw_keys: result.rawKeys,
          truncated: result.items.length > items.length,
        };
      }),
    );

  leave
    .command('get')
    .description('查询单条请假详情')
    .requiredOption('--id <id>', '请假记录 ID')
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as { id: string };
        const vault = await openVaultOrPrompt(true);
        const session = getSession(vault);
        const data = await new XgxtClient().leaveInfo(session, opts.id);
        return { id: opts.id, data };
      }),
    );

  leave
    .command('form')
    .description('读取请假表单模板与选项')
    .action(
      commandAction(async () => {
        const vault = await openVaultOrPrompt(true);
        const session = getSession(vault);
        const data = await new XgxtClient().leaveInfo(session, '');
        return { data };
      }),
    );

  leave
    .command('apply')
    .description('预览或提交请假申请，默认 dry-run')
    .requiredOption('--input <file>', 'JSON 文件路径，或 - 表示 stdin')
    .option('--execute', '真实提交', false)
    .option('--confirm <token>', '预览返回的 confirm token')
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as { input: string; execute?: boolean; confirm?: string };
        const input = await readJsonInput(opts.input);
        const vault = await openVaultOrPrompt(true);
        const session = getSession(vault);
        const sessionHash = sessionFingerprint('xgxt', session);
        const client = new XgxtClient();
        const existing = await client.listLeaves(session, 1);
        if (String(existing.isApply) === '1') {
          throw new WzvtcError('precondition_failed', '当前已有有效请假，请先销假或撤销', {
            action: {
              type: 'ask_user',
              message: '先运行 wzvtc xgxt leave list 查看当前请假状态',
              requires_user: true,
            },
          });
        }
        const prepared = await prepareApplyInfo(client, session, input);
        let info = prepared.info;
        let calculationError: string | undefined;
        try {
          info = applyLeaveCalculations(info);
        } catch (error) {
          calculationError = error instanceof WzvtcError ? error.message : '请假时间计算失败';
        }
        const validation = validateLeaveInfo(info, Boolean(opts.execute));
        if (calculationError && !validation.errors.includes(calculationError)) {
          validation.errors.unshift(calculationError);
        }
        const summary = summarizeLeave(info);
        const inputHash = hashInput({
          tool: 'xgxt.leave.apply',
          info: stableLeaveInfoForHash(info),
        });

        if (!opts.execute) {
          const pending =
            validation.errors.length === 0
              ? createPending('xgxt.leave.apply', inputHash, summaryForPending(summary), {
                  sessionHash,
                })
              : null;
          return {
            executed: false,
            ready_to_submit: Boolean(pending),
            validation,
            preview: { summary, info, template_keys: prepared.templateKeys },
            confirm_token: pending ? packConfirmToken(pending.id, pending.token) : undefined,
            expires_at: pending?.expiresAt,
          };
        }

        if (validation.errors.length > 0) {
          throw new WzvtcError('invalid_input', '请假表单校验未通过', {
            action: {
              type: 'ask_user',
              message: '按 validation.errors 修正后重新预览；不要绕过校验',
              requires_user: true,
            },
            details: { errors: validation.errors },
          });
        }

        if (!opts.confirm) {
          throw new WzvtcError('confirmation_required', '真实提交需要 confirm token', {
            action: {
              type: 'ask_user',
              message: '先预览并取得用户确认，再用 --execute --confirm <token>',
              requires_user: true,
            },
          });
        }

        return executeConfirmedWrite({
          tool: 'xgxt.leave.apply',
          inputHash,
          sessionHash,
          confirm: opts.confirm,
          summary,
          execute: () => client.saveLeave(session, info),
          verify: () => verifyApplied(client, session, info),
        });
      }),
    );

  leave
    .command('cancel')
    .description('预览或撤销请假申请，默认 dry-run')
    .requiredOption('--id <id>', '请假记录 ID')
    .option('--execute', '真实撤销', false)
    .option('--confirm <token>', '预览返回的 confirm token')
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as { id: string; execute?: boolean; confirm?: string };
        const vault = await openVaultOrPrompt(true);
        const session = getSession(vault);
        const sessionHash = sessionFingerprint('xgxt', session);
        const client = new XgxtClient();
        const detail = await client.leaveInfo(session, opts.id);
        const info = isPlainObject(detail.Info) ? detail.Info : {};
        const summary = summarizeLeave(info);
        const inputHash = hashInput({ tool: 'xgxt.leave.cancel', id: opts.id });

        if (!opts.execute) {
          const pending = createPending('xgxt.leave.cancel', inputHash, summaryForPending(summary), {
            sessionHash,
          });
          return {
            executed: false,
            preview: { id: opts.id, summary },
            confirm_token: packConfirmToken(pending.id, pending.token),
            expires_at: pending.expiresAt,
          };
        }

        if (!opts.confirm) {
          throw new WzvtcError('confirmation_required', '真实撤销需要 confirm token', {
            action: {
              type: 'ask_user',
              message: '先预览并取得用户确认，再用 --execute --confirm <token>',
              requires_user: true,
            },
          });
        }

        return executeConfirmedWrite({
          tool: 'xgxt.leave.cancel',
          inputHash,
          sessionHash,
          confirm: opts.confirm,
          summary,
          execute: () => client.deleteLeave(session, opts.id),
          verify: async () => {
            try {
              const list = await client.listLeaves(session, 1);
              const stillPresent = list.items.some((item) => JSON.stringify(item).includes(opts.id));
              return stillPresent
                ? { status: 'unverified', note: '撤销后列表仍能看到该记录，请手动核对' }
                : { status: 'verified', note: '撤销后列表不再出现该记录' };
            } catch (error) {
              return {
                status: 'unverified',
                note: `撤销后回查失败：${error instanceof WzvtcError ? error.code : 'unknown'}；请手动核对`,
              };
            }
          },
        });
      }),
    );
}
