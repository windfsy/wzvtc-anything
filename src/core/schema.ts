import { WzvtcError } from './errors.js';
import { CLI_VERSION, SCHEMA_VERSION } from './version.js';

export type CommandRisk = 'meta' | 'read' | 'write' | 'auth' | 'vault';

export interface CommandSpec {
  name: string;
  path: string[];
  description: string;
  risk: CommandRisk;
  auth?: { provider: string; channel?: string };
  input_schema?: Record<string, unknown>;
  examples?: string[];
}

export const COMMANDS: CommandSpec[] = [
  {
    name: 'version',
    path: ['version'],
    description: '输出版本、schema 版本与 Node 运行环境',
    risk: 'meta',
  },
  {
    name: 'doctor',
    path: ['doctor'],
    description: '检查 Vault、钥匙串、登录态与运行环境；不主动提示主密码',
    risk: 'meta',
    input_schema: {
      type: 'object',
      properties: { probe: { type: 'boolean', default: false } },
    },
    examples: ['wzvtc doctor', 'wzvtc doctor --probe'],
  },
  {
    name: 'schema',
    path: ['schema'],
    description: '输出机器可读的命令目录',
    risk: 'meta',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        compact: { type: 'boolean', default: false },
      },
    },
    examples: ['wzvtc schema --compact', 'wzvtc schema xgxt.leave.apply'],
  },
  {
    name: 'skills.install',
    path: ['skills', 'install'],
    description: '把内置 Skill 安装到 Agent 技能目录',
    risk: 'meta',
    input_schema: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['claude-code', 'codex', 'cursor', 'agents'] },
        dest: { type: 'string' },
      },
      required: ['target'],
    },
    examples: ['wzvtc skills install --target claude-code', 'wzvtc skills install --target agents --dest ./skills'],
  },
  {
    name: 'skills.path',
    path: ['skills', 'path'],
    description: '输出内置 Agent Skill 目录',
    risk: 'meta',
    examples: ['wzvtc skills path'],
  },
  {
    name: 'skills.list',
    path: ['skills', 'list'],
    description: '列出内置 Skill 文件',
    risk: 'meta',
    examples: ['wzvtc skills list'],
  },
  {
    name: 'skills.read',
    path: ['skills', 'read'],
    description: '读取 SKILL.md 或 references 文件',
    risk: 'meta',
    input_schema: {
      type: 'object',
      properties: { file: { type: 'string', default: 'SKILL.md' } },
    },
    examples: ['wzvtc skills read', 'wzvtc skills read references/xgxt.md'],
  },
  {
    name: 'vault.init',
    path: ['vault', 'init'],
    description: '初始化 Vault、设置主密码，可选信任当前设备',
    risk: 'vault',
    input_schema: {
      type: 'object',
      properties: {
        trust_device: { type: 'boolean' },
        password_stdin: { type: 'boolean' },
      },
    },
    examples: ['wzvtc vault init', 'wzvtc vault init --trust-device'],
  },
  {
    name: 'vault.status',
    path: ['vault', 'status'],
    description: '查看 Vault 是否初始化、钥匙串可用性、设备信任和条目数量；不返回明文',
    risk: 'vault',
    examples: ['wzvtc vault status'],
  },
  {
    name: 'vault.list',
    path: ['vault', 'list'],
    description: '列出 Vault 条目的元数据，不返回凭证',
    risk: 'vault',
    examples: ['wzvtc vault list'],
  },
  {
    name: 'vault.devices',
    path: ['vault', 'devices'],
    description: '列出已信任设备的 ID 与创建时间',
    risk: 'vault',
    examples: ['wzvtc vault devices'],
  },
  {
    name: 'vault.trust-device',
    path: ['vault', 'trust-device'],
    description: '为当前设备生成并保存钥匙串设备密钥',
    risk: 'vault',
    examples: ['wzvtc vault trust-device'],
  },
  {
    name: 'vault.revoke-device',
    path: ['vault', 'revoke-device'],
    description: '撤销指定设备的钥匙串信任',
    risk: 'vault',
    input_schema: {
      type: 'object',
      properties: {
        device_id: { type: 'string' },
        yes: { type: 'boolean', default: false },
      },
      required: ['device_id'],
    },
    examples: ['wzvtc vault revoke-device <deviceId> --yes'],
  },
  {
    name: 'vault.reset',
    path: ['vault', 'reset'],
    description: '删除 Vault、会话、pending、operations、日志、缓存与设备信任',
    risk: 'vault',
    input_schema: {
      type: 'object',
      properties: {
        purge: { type: 'boolean' },
        confirm: { type: 'string', enum: ['RESET'] },
      },
      required: ['purge'],
    },
    examples: ['wzvtc vault reset --purge --confirm RESET'],
  },
  {
    name: 'auth.import.xgxt',
    path: ['auth', 'import', 'xgxt'],
    description: '从微信学工链接导入一次性 code，换取 token 并写入 Vault',
    risk: 'auth',
    auth: { provider: 'xgxt', channel: 'wechat-mobile' },
    input_schema: {
      type: 'object',
      properties: {
        channel: { type: 'string', enum: ['wechat-mobile'], default: 'wechat-mobile' },
      },
    },
    examples: ['wzvtc auth import xgxt --channel wechat-mobile'],
  },
  {
    name: 'auth.login.xgxt',
    path: ['auth', 'login', 'xgxt'],
    description: '学工移动端账号密码登录（备用；优先 link-code）；只存 token，不保存密码',
    risk: 'auth',
    auth: { provider: 'xgxt', channel: 'wechat-mobile' },
    input_schema: {
      type: 'object',
      properties: { password_stdin: { type: 'boolean', default: false } },
    },
    examples: ['wzvtc auth login xgxt --password-stdin'],
  },
  {
    name: 'auth.status.xgxt',
    path: ['auth', 'status', 'xgxt'],
    description: '查看学工会话是否存在；可选 probe',
    risk: 'auth',
    auth: { provider: 'xgxt', channel: 'wechat-mobile' },
    input_schema: {
      type: 'object',
      properties: { probe: { type: 'boolean', default: false } },
    },
    examples: ['wzvtc auth status xgxt', 'wzvtc auth status xgxt --probe'],
  },
  {
    name: 'xgxt.leave.list',
    path: ['xgxt', 'leave', 'list'],
    description: '查询学工请假列表',
    risk: 'read',
    auth: { provider: 'xgxt', channel: 'wechat-mobile' },
    input_schema: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1 },
        limit: { type: 'integer', default: 20, maximum: 100 },
      },
    },
    examples: ['wzvtc xgxt leave list', 'wzvtc xgxt leave list --page 2 --limit 10'],
  },
  {
    name: 'xgxt.leave.get',
    path: ['xgxt', 'leave', 'get'],
    description: '查询单条学工请假详情',
    risk: 'read',
    auth: { provider: 'xgxt', channel: 'wechat-mobile' },
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    examples: ['wzvtc xgxt leave get --id <id>'],
  },
  {
    name: 'xgxt.leave.form',
    path: ['xgxt', 'leave', 'form'],
    description: '读取学工请假表单模板与选项，用于字段发现',
    risk: 'read',
    auth: { provider: 'xgxt', channel: 'wechat-mobile' },
    examples: ['wzvtc xgxt leave form'],
  },
  {
    name: 'xgxt.leave.apply',
    path: ['xgxt', 'leave', 'apply'],
    description: '预览或提交学工请假申请；默认 dry-run',
    risk: 'write',
    auth: { provider: 'xgxt', channel: 'wechat-mobile' },
    input_schema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'JSON 文件路径，或 - 表示 stdin' },
        execute: { type: 'boolean', default: false },
        confirm: { type: 'string', description: '预览返回的 confirm token' },
      },
      required: ['input'],
    },
    examples: [
      'wzvtc xgxt leave apply --input leave.json',
      'wzvtc xgxt leave apply --input leave.json --execute --confirm <token>',
    ],
  },
  {
    name: 'xgxt.leave.cancel',
    path: ['xgxt', 'leave', 'cancel'],
    description: '预览或撤销学工请假申请；默认 dry-run',
    risk: 'write',
    auth: { provider: 'xgxt', channel: 'wechat-mobile' },
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        execute: { type: 'boolean', default: false },
        confirm: { type: 'string' },
      },
      required: ['id'],
    },
    examples: [
      'wzvtc xgxt leave cancel --id <id>',
      'wzvtc xgxt leave cancel --id <id> --execute --confirm <token>',
    ],
  },
  {
    name: 'auth.login.dekt',
    path: ['auth', 'login', 'dekt'],
    description: '账号密码登录第二课堂；只存 token，不保存密码',
    risk: 'auth',
    auth: { provider: 'dekt' },
    input_schema: {
      type: 'object',
      properties: { password_stdin: { type: 'boolean', default: false } },
    },
    examples: ['wzvtc auth login dekt --password-stdin'],
  },
  {
    name: 'auth.status.dekt',
    path: ['auth', 'status', 'dekt'],
    description: '查看第二课堂会话；可选 probe',
    risk: 'auth',
    auth: { provider: 'dekt' },
    input_schema: {
      type: 'object',
      properties: { probe: { type: 'boolean', default: false } },
    },
    examples: ['wzvtc auth status dekt --probe'],
  },
  {
    name: 'dekt.activity.list',
    path: ['dekt', 'activity', 'list'],
    description: '查询第二课堂活动列表（只读）',
    risk: 'read',
    auth: { provider: 'dekt' },
    input_schema: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1 },
        limit: { type: 'integer', default: 20, maximum: 100 },
        status: { type: 'integer', default: -1 },
      },
    },
    examples: ['wzvtc dekt activity list', 'wzvtc dekt activity list --status 3'],
  },
  {
    name: 'dekt.activity.get',
    path: ['dekt', 'activity', 'get'],
    description: '查询第二课堂活动详情（只读）',
    risk: 'read',
    auth: { provider: 'dekt' },
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    examples: ['wzvtc dekt activity get --id <id>'],
  },
  {
    name: 'dekt.activity.enroll',
    path: ['dekt', 'activity', 'enroll'],
    description: '预览或报名第二课堂活动；默认 dry-run',
    risk: 'write',
    auth: { provider: 'dekt' },
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        role: { type: 'string' },
        execute: { type: 'boolean', default: false },
        confirm: { type: 'string' },
      },
      required: ['id'],
    },
    examples: [
      'wzvtc dekt activity enroll --id <id>',
      'wzvtc dekt activity enroll --id <id> --execute --confirm <token>',
    ],
  },
  {
    name: 'dekt.activity.cancel',
    path: ['dekt', 'activity', 'cancel'],
    description: '预览或取消第二课堂报名；默认 dry-run',
    risk: 'write',
    auth: { provider: 'dekt' },
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        enrollment_id: { type: 'string' },
        execute: { type: 'boolean', default: false },
        confirm: { type: 'string' },
      },
      required: ['id'],
    },
    examples: [
      'wzvtc dekt activity cancel --id <id>',
      'wzvtc dekt activity cancel --id <id> --execute --confirm <token>',
    ],
  },
  {
    name: 'dekt.transcript.get',
    path: ['dekt', 'transcript', 'get'],
    description: '查询第二课堂成绩单与总学时（只读）',
    risk: 'read',
    auth: { provider: 'dekt' },
    input_schema: {
      type: 'object',
      properties: { page: { type: 'integer', default: 1 } },
    },
    examples: ['wzvtc dekt transcript get'],
  },
  {
    name: 'auth.login.zyh',
    path: ['auth', 'login', 'zyh'],
    description: '账号密码登录志愿汇；只存 token，不保存密码',
    risk: 'auth',
    auth: { provider: 'zyh' },
    input_schema: {
      type: 'object',
      properties: { password_stdin: { type: 'boolean', default: false } },
    },
    examples: ['wzvtc auth login zyh --password-stdin'],
  },
  {
    name: 'auth.status.zyh',
    path: ['auth', 'status', 'zyh'],
    description: '查看志愿汇会话；可选 probe',
    risk: 'auth',
    auth: { provider: 'zyh' },
    input_schema: {
      type: 'object',
      properties: { probe: { type: 'boolean', default: false } },
    },
    examples: ['wzvtc auth status zyh --probe'],
  },
  {
    name: 'zyh.hours.summary',
    path: ['zyh', 'hours', 'summary'],
    description: '查询志愿时长汇总（只读）',
    risk: 'read',
    auth: { provider: 'zyh' },
    examples: ['wzvtc zyh hours summary'],
  },
  {
    name: 'zyh.hours.list',
    path: ['zyh', 'hours', 'list'],
    description: '查询志愿时长明细（只读）',
    risk: 'read',
    auth: { provider: 'zyh' },
    input_schema: {
      type: 'object',
      properties: {
        year: { type: 'integer' },
        page: { type: 'integer', default: 1 },
        limit: { type: 'integer', default: 20, maximum: 100 },
      },
    },
    examples: ['wzvtc zyh hours list --year 2026'],
  },
  {
    name: 'operations.list',
    path: ['operations', 'list'],
    description: '列出本地写操作日志与对账状态',
    risk: 'meta',
    examples: ['wzvtc operations list'],
  },
  {
    name: 'operations.get',
    path: ['operations', 'get'],
    description: '查看单条写操作日志，用于超时后对账',
    risk: 'meta',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    examples: ['wzvtc operations get <id>'],
  },
];

export function getSchema(compact = false): unknown {
  const commands = compact
    ? COMMANDS.map(({ name, path, description, risk, auth }) => ({
        name,
        path,
        description,
        risk,
        auth,
      }))
    : COMMANDS;
  return {
    schema_version: SCHEMA_VERSION,
    cli_version: CLI_VERSION,
    commands,
  };
}

interface SchemaShape {
  schema_version: string;
  cli_version: string;
  commands: Array<{ name: string; path: string[] }>;
}

export function filterSchema(compact = false, command?: string): unknown {
  const schema = getSchema(compact) as SchemaShape;
  if (!command) return schema;
  const needle = command.trim();
  const commands = schema.commands.filter(
    (entry) =>
      entry.name === needle ||
      entry.path.join(' ') === needle ||
      entry.path.join('.') === needle,
  );
  if (commands.length === 0) {
    throw new WzvtcError('not_found', `未知命令：${needle}`, {
      action: {
        type: 'run_command',
        command: 'wzvtc schema --compact',
        message: '运行 wzvtc schema --compact 查看全部命令',
      },
    });
  }
  return { ...schema, commands };
}
