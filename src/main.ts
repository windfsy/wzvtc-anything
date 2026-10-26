#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { WzvtcError, asWzvtcError } from './core/errors.js';
import { emitError } from './core/envelope.js';
import { registerCommands } from './cli/commands.js';

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('wzvtc')
    .description('WZVTC campus services for AI agents: JSON CLI + Vault + Skill')
    .exitOverride();
  program.configureOutput({
    writeOut: (text) => process.stdout.write(text),
    writeErr: () => {},
  });

  registerCommands(program);

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === 'commander.helpDisplayed') {
        process.exitCode = 0;
        return;
      }
      emitError(
        new WzvtcError('usage_error', error.message.replace(/^error:\s*/i, ''), {
          action: {
            type: 'ask_user',
            message: '运行 wzvtc schema --compact 查看可用命令',
            requires_user: false,
          },
        }),
      );
      return;
    }
    emitError(asWzvtcError(error));
  }
}

await main();
