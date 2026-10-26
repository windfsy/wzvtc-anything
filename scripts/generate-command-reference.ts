import fs from 'node:fs';
import path from 'node:path';
import { getSchema } from '../src/core/schema.js';

interface CommandSpec {
  name: string;
  path: string[];
  description: string;
  risk: string;
  auth?: { provider: string; channel?: string };
  input_schema?: Record<string, unknown>;
  examples?: string[];
}

const schema = getSchema(false) as {
  schema_version: string;
  cli_version: string;
  commands: CommandSpec[];
};

const lines: string[] = [
  '# 命令参考',
  '',
  `> 由 \`pnpm docs:commands\` 从 CLI schema 生成；CLI ${schema.cli_version} / schema ${schema.schema_version}。请勿手工编辑。`,
  '',
  '所有命令默认输出 JSON 信封。写操作默认 dry-run，真实执行必须带 `--execute --confirm <token>`。',
  '',
];

for (const command of schema.commands) {
  const commandLine = `wzvtc ${command.path.join(' ')}`;
  lines.push(`## \`${commandLine}\``, '');
  lines.push(command.description, '');
  lines.push(`- 名称：\`${command.name}\``);
  lines.push(`- 风险：\`${command.risk}\``);
  if (command.auth) {
    lines.push(
      `- 认证：\`${command.auth.provider}\`${command.auth.channel ? ` / \`${command.auth.channel}\`` : ''}`,
    );
  }
  lines.push('');
  if (command.input_schema) {
    lines.push('```json');
    lines.push(JSON.stringify(command.input_schema, null, 2));
    lines.push('```', '');
  }
  if (command.examples?.length) {
    lines.push('示例：', '', '```bash');
    lines.push(...command.examples);
    lines.push('```', '');
  }
}

const output = path.resolve('docs/commands.md');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${lines.join('\n')}\n`);
console.log(`wrote ${output}`);
