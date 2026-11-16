import { describe, expect, it } from 'vitest';
import en from './en.json';
import tr from './tr.json';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('translations', () => {
  it('have the same keys in Turkish and English', () => {
    expect(keys(en).sort()).toEqual(keys(tr).sort());
  });

  it('have no empty strings', () => {
    const empty = [...keys(en), ...keys(tr)].filter((key) => {
      const pick = (source: unknown) =>
        key
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], source);
      return pick(en) === '' || pick(tr) === '';
    });
    expect(empty).toEqual([]);
  });
});
