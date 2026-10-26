import { describe, expect, it } from 'vitest';
import { parseCounter } from '../../src/core/adCounter';

describe('parseCounter', () => {
  it.each([
    ['Ad 1 of 2', { index: 1, total: 2 }],
    ['1/2', { index: 1, total: 2 }],
    ['Quảng cáo 2 trên 3', { index: 2, total: 3 }],
  ])('đọc được %s', (text, expected) => {
    expect(parseCounter(text)).toEqual(expected);
  });

  it.each([null, undefined, '', 'Ad', '0:15', 'Ad · 1:30', '3 of 2'])('từ chối %j', (text) => {
    expect(parseCounter(text)).toBeNull();
  });
});