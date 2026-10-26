import type { Command } from 'commander';
import { getOperation, listOperations } from '../../core/operations.js';
import { commandAction } from '../command.js';

export function registerOperationsCommands(program: Command): void {
  const operations = program.command('operations').description('本地写操作日志与对账');

  operations
    .command('list')
    .description('列出最近写操作')
    .action(
      commandAction(async () => {
        const items = listOperations();
        return { items, returned: items.length };
      }),
    );

  operations
    .command('get <id>')
    .description('查看单条写操作')
    .action(
      commandAction(async (id: unknown) => {
        return { operation: getOperation(String(id)) };
      }),
    );
}
