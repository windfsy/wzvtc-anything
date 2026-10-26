import { describe, expect, it } from 'vitest';
import { filterSchema } from '../src/core/schema.js';

interface SchemaShape {
  commands: Array<{ name: string; path: string[] }>;
}

describe('schema filtering', () => {
  it('returns all commands without a filter', () => {
    const schema = filterSchema(true) as SchemaShape;
    expect(schema.commands.length).toBeGreaterThan(30);
  });

  it('filters by dotted name and command path', () => {
    const dotted = filterSchema(true, 'xgxt.leave.apply') as SchemaShape;
    expect(dotted.commands).toHaveLength(1);
    expect(dotted.commands[0]?.name).toBe('xgxt.leave.apply');

    const spaced = filterSchema(true, 'dekt activity enroll') as SchemaShape;
    expect(spaced.commands).toHaveLength(1);
    expect(spaced.commands[0]?.name).toBe('dekt.activity.enroll');
  });

  it('rejects an unknown command', () => {
    expect(() => filterSchema(true, 'xgxt.leave.nope')).toThrowError();
  });
});
