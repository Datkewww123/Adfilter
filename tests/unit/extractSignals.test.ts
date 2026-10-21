// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { extractSignals } from '../../src/content/extractSignals';

const load = (name: string) => readFileSync(`tests/fixtures/html/${name}`, 'utf8');

describe('extractSignals', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('không có player thì playerFound = false', () => {
    const s = extractSignals(document, 1);
    expect(s.playerFound).toBe(false);
    expect(s.adShowing).toBe(false);
  });

  it('video thường: có player, không có quảng cáo', () => {
    document.body.innerHTML = load('normal.html');
    const s = extractSignals(document, 2);
    expect(s.playerFound).toBe(true);
    expect(s.adShowing).toBe(false);
    expect(s.adOverlay).toBe(false);
  });

  it('có quảng cáo: nhận ra class, lớp phủ và huy hiệu', () => {
    document.body.innerHTML = load('ad-showing.html');
    const s = extractSignals(document, 3);
    expect(s.adShowing).toBe(true);
    expect(s.adOverlay).toBe(true);
    expect(s.adBadge).toBe(true);
  });

  it('duration luôn là số hữu hạn hoặc null', () => {
    document.body.innerHTML = load('normal.html');
    const { duration } = extractSignals(document, 4);
    expect(duration === null || Number.isFinite(duration)).toBe(true);
  });
});