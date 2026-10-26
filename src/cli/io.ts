import fs from 'node:fs';
import { WzvtcError } from '../core/errors.js';
import { isPlainObject } from '../core/json.js';
import { readAllInput } from '../core/secret.js';

export async function readJsonInput(file: string): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = file === '-' ? await readAllInput() : fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new WzvtcError('invalid_input', `无法读取输入文件：${file}`, {
      cause: error,
      action: {
        type: 'ask_user',
        message: '检查路径，或使用 --input - 从 stdin 读取',
        requires_user: true,
      },
    });
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isPlainObject(parsed)) {
      throw new WzvtcError('invalid_input', '输入必须是 JSON 对象');
    }
    return parsed;
  } catch (error) {
    if (error instanceof WzvtcError) throw error;
    throw new WzvtcError('invalid_input', '输入不是合法 JSON', { cause: error });
  }
}

export function positiveInt(value: string | undefined, fallback: number, max = 100): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new WzvtcError('invalid_input', `需要正整数，收到：${value}`);
  }
  return Math.min(parsed, max);
}
