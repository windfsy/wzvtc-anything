export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function deepMerge<T>(base: T, patch: unknown): T {
  if (isPlainObject(base) && isPlainObject(patch)) {
    const output: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      if (UNSAFE_KEYS.has(key)) continue;
      if (isPlainObject(output[key]) && isPlainObject(value)) {
        output[key] = deepMerge(output[key], value);
      } else {
        output[key] = value;
      }
    }
    return output as T;
  }
  return (patch === undefined ? base : patch) as T;
}

export function truncate(value: string, max = 2000): { value: string; truncated: boolean } {
  if (value.length <= max) return { value, truncated: false };
  return { value: `${value.slice(0, max)}…`, truncated: true };
}
