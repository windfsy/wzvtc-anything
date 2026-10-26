import type { Command } from 'commander';
import { registerAuthCommands } from './commands/auth.js';
import { registerDektCommands } from './commands/dekt.js';
import { registerMetaCommands } from './commands/meta.js';
import { registerOperationsCommands } from './commands/operations.js';
import { registerSkillsCommands } from './commands/skills.js';
import { registerVaultCommands } from './commands/vault.js';
import { registerXgxtCommands } from './commands/xgxt.js';
import { registerZyhCommands } from './commands/zyh.js';

export function registerCommands(program: Command): void {
  registerMetaCommands(program);
  registerSkillsCommands(program);
  registerVaultCommands(program);
  registerAuthCommands(program);
  registerXgxtCommands(program);
  registerDektCommands(program);
  registerZyhCommands(program);
  registerOperationsCommands(program);
}
