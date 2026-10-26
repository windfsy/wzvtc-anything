import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  bundledSkillDir,
  installSkill,
  listSkillFiles,
  readSkillFile,
  skillExists,
} from '../src/core/skills.js';

describe('bundled skill', () => {
  it('is bundled and has SKILL.md plus references', () => {
    expect(skillExists()).toBe(true);
    expect(bundledSkillDir()).toContain('wzvtc-anything');
    expect(listSkillFiles()).toContain('SKILL.md');
    expect(listSkillFiles()).toContain('references/xgxt.md');
  });

  it('reads SKILL.md', () => {
    const skill = readSkillFile();
    expect(skill.file).toBe('SKILL.md');
    expect(skill.content).toContain('WZVTC');
  });

  it('rejects path traversal', () => {
    expect(() => readSkillFile('../package.json')).toThrowError();
  });

  it('has no stale milestone labels and declares current write commands', () => {
    const files = [
      'SKILL.md',
      'references/auth-vault.md',
      'references/xgxt.md',
      'references/dekt.md',
      'references/zyh.md',
    ];
    const content = files.map((file) => readSkillFile(file).content).join('\n');
    expect(content).not.toMatch(/\bM[0-9]\b/);
    expect(content).toContain('dekt activity enroll');
    expect(content).toContain('dekt activity cancel');
    expect(content).toContain('vault revoke-device');
    expect(content).toContain('vault reset');
  });

  it('installs the bundled skill into a custom destination', () => {
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'wzvtc-skill-install-'));
    try {
      const result = installSkill('agents', destination);
      expect(result.path).toBe(path.resolve(destination));
      expect(fs.existsSync(path.join(destination, 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(destination, 'references', 'dekt.md'))).toBe(true);
    } finally {
      fs.rmSync(destination, { recursive: true, force: true });
    }
  });
});
