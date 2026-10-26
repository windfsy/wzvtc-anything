import type { Command } from 'commander';
import { WzvtcError } from '../../core/errors.js';
import {
  bundledSkillDir,
  installSkill,
  listSkillFiles,
  readSkillFile,
  SKILL_NAME,
  type SkillTarget,
} from '../../core/skills.js';
import { commandAction } from '../command.js';

const TARGETS: SkillTarget[] = ['claude-code', 'codex', 'cursor', 'agents'];

export function registerSkillsCommands(program: Command): void {
  const skills = program.command('skills').description('读取内置 Agent Skill');

  skills
    .command('install')
    .description('把内置 Skill 安装到 Agent 技能目录')
    .requiredOption('--target <target>', 'claude-code | codex | cursor | agents')
    .option('--dest <dir>', '自定义安装目录（精确路径）')
    .action(
      commandAction(async (options: unknown) => {
        const opts = options as { target: string; dest?: string };
        if (!TARGETS.includes(opts.target as SkillTarget)) {
          throw new WzvtcError('invalid_input', `不支持的安装目标：${opts.target}`, {
            details: { targets: TARGETS },
          });
        }
        return installSkill(opts.target as SkillTarget, opts.dest);
      }),
    );

  skills
    .command('path')
    .description('输出内置 Skill 目录')
    .action(
      commandAction(async () => ({
        name: SKILL_NAME,
        path: bundledSkillDir(),
      })),
    );

  skills
    .command('list')
    .description('列出内置 Skill 文件')
    .action(
      commandAction(async () => ({
        name: SKILL_NAME,
        files: listSkillFiles(),
      })),
    );

  skills
    .command('read [file]')
    .description('读取 SKILL.md 或 references 文件')
    .action(
      commandAction(async (file: unknown) => {
        return readSkillFile(file ? String(file) : 'SKILL.md');
      }),
    );
}
