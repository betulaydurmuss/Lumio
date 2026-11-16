import { describe, expect, it } from 'vitest';
import { formatDuration, formatMoney } from './format.js';

describe('formatMoney', () => {
  it('drops decimals for whole amounts and keeps them otherwise', () => {
    expect(formatMoney(24900, 'TRY', 'tr')).toBe('₺249');
    expect(formatMoney(24950, 'TRY', 'tr')).toBe('₺249,50');
  });
});

describe('formatDuration', () => {
  it('reads naturally in both languages', () => {
    expect(formatDuration(45, 'tr')).toBe('45 dk');
    expect(formatDuration(120, 'en')).toBe('2 h');
    expect(formatDuration(95, 'tr')).toBe('1 sa 35 dk');
  });
});
