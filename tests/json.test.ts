import { describe, expect, it } from 'vitest';
import { deepMerge } from '../src/core/json.js';

describe('deepMerge', () => {
  it('ignores prototype-pollution keys', () => {
    const patch = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"x":1},"b":2}');
    const merged = deepMerge({ a: 1 }, patch);
    expect(merged).toMatchObject({ a: 1, b: 2 });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});
