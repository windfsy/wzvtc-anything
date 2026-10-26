import readline from 'node:readline/promises';
import { WzvtcError } from './errors.js';

async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

export async function readLine(prompt: string, defaultValue = ''): Promise<string> {
  process.stderr.write(prompt);
  if (!process.stdin.isTTY) {
    const value = await readAllStdin();
    process.stderr.write('\n');
    return value.length > 0 ? value : defaultValue;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question('');
    return answer.trim().length > 0 ? answer.trim() : defaultValue;
  } finally {
    rl.close();
  }
}

export async function confirm(prompt: string, defaultValue = true): Promise<boolean> {
  const suffix = defaultValue ? ' (Y/n) ' : ' (y/N) ';
  const answer = (await readLine(`${prompt}${suffix}`)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return answer === 'y' || answer === 'yes' || answer === '是';
}

export async function readSecret(prompt: string): Promise<string> {
  process.stderr.write(prompt);
  if (!process.stdin.isTTY) {
    const value = await readAllStdin();
    process.stderr.write('\n');
    return value;
  }

  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  if (typeof stdin.setRawMode !== 'function') {
    throw new WzvtcError('keychain_unavailable', '当前终端不支持隐藏输入', {
      action: {
        type: 'ask_user',
        message: '请在支持 TTY 的终端中运行，或在非交互环境使用受控 stdin',
        requires_user: true,
      },
    });
  }

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise<string>((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\u0003') {
          cleanup();
          process.stderr.write('\n');
          reject(new WzvtcError('usage_error', '已取消输入'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          process.stderr.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= ' ') value += char;
      }
    };
    stdin.on('data', onData);
  });
}

export async function readAllInput(): Promise<string> {
  return readAllStdin();
}
