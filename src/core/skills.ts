import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WzvtcError } from './errors.js';

export const SKILL_NAME = 'wzvtc-anything';
export type SkillTarget = 'claude-code' | 'codex' | 'cursor' | 'agents';

const TARGET_DIRS: Record<SkillTarget, string[]> = {
  'claude-code': ['.claude', 'skills'],
  codex: ['.codex', 'skills'],
  cursor: ['.cursor', 'skills'],
  agents: ['.agents', 'skills'],
};

export function bundledSkillDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '../../skills', SKILL_NAME),
    path.resolve(process.cwd(), 'skills', SKILL_NAME),
  ];
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'SKILL.md'))) ?? candidates[0];
}

export function skillExists(): boolean {
  return fs.existsSync(path.join(bundledSkillDir(), 'SKILL.md'));
}

function listFilesUnder(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        files.push(path.relative(root, absolute).split(path.sep).join('/'));
      }
    }
  };
  walk(root);
  return files.sort();
}

export function listSkillFiles(): string[] {
  return listFilesUnder(bundledSkillDir());
}

export function defaultSkillTargetDir(target: SkillTarget): string {
  const parts = TARGET_DIRS[target];
  if (!parts) {
    throw new WzvtcError('invalid_input', `不支持的 Skill 安装目标：${target}`, {
      details: { targets: Object.keys(TARGET_DIRS) },
    });
  }
  return path.join(os.homedir(), ...parts);
}

export function installSkill(
  target: SkillTarget,
  dest?: string,
): { target: SkillTarget; path: string; files: string[] } {
  const source = bundledSkillDir();
  if (!fs.existsSync(path.join(source, 'SKILL.md'))) {
    throw new WzvtcError('not_found', '内置 Skill 不存在');
  }
  const destination = dest
    ? path.resolve(dest)
    : path.join(defaultSkillTargetDir(target), SKILL_NAME);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
  return {
    target,
    path: destination,
    files: listFilesUnder(destination),
  };
}

export function readSkillFile(relative = 'SKILL.md'): { file: string; content: string } {
  const root = bundledSkillDir();
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
    throw new WzvtcError('invalid_input', '非法 Skill 文件路径');
  }
  const normalized = path.normalize(relative);
  const absolute = path.resolve(root, normalized);
  if (!absolute.startsWith(path.resolve(root) + path.sep) && absolute !== path.resolve(root, 'SKILL.md')) {
    throw new WzvtcError('invalid_input', '非法 Skill 文件路径');
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new WzvtcError('not_found', `Skill 文件不存在：${relative}`);
  }
  return {
    file: normalized.split(path.sep).join('/'),
    content: fs.readFileSync(absolute, 'utf8'),
  };
}
