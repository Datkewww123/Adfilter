import { describe, expect, it } from 'vitest';
import { buildFixture, intervalsOf, isFixture, labelIntervals } from '../../src/core/fixture';
import type { Signals } from '../../src/core/types';

const frame = (t: number, label?: boolean): Signals => ({
  t,
  playerFound: true,
  adShowing: false,
  adOverlay: false,
  adBadge: false,
  skipVisible: false,
  duration: null,
  currentTime: null,
  paused: null,
  label,
});

describe('labelIntervals', () => {
  it('rỗng khi không có frame', () => {
    expect(labelIntervals([])).toEqual([]);
  });

  it('một khoảng ở giữa', () => {
    const fr = [frame(0, false), frame(100, true), frame(200, true), frame(300, false)];
    expect(labelIntervals(fr)).toEqual([{ start: 100, end: 200 }]);
  });

  it('khoảng kéo dài tới frame cuối', () => {
    const fr = [frame(0, false), frame(100, true), frame(200, true)];
    expect(labelIntervals(fr)).toEqual([{ start: 100, end: 200 }]);
  });

  it('hai khoảng tách biệt, label undefined tính là false', () => {
    const fr = [frame(0, true), frame(100), frame(200, true), frame(300, true)];
    expect(labelIntervals(fr)).toEqual([
      { start: 0, end: 0 },
      { start: 200, end: 300 },
    ]);
  });
});

describe('intervalsOf', () => {
  it('dùng điều kiện tùy ý', () => {
    const fr = [
      frame(0),
      { ...frame(100), adShowing: true },
      { ...frame(200), adShowing: true },
      frame(300),
    ];
    expect(intervalsOf(fr, (f) => f.adShowing)).toEqual([{ start: 100, end: 200 }]);
  });
});

describe('isFixture', () => {
  const meta = { recordedAt: '2026-10-06T00:00:00.000Z', browser: 'Chrome/1', note: '' };

  it('chấp nhận fixture hợp lệ', () => {
    expect(isFixture(buildFixture([frame(0)], meta))).toBe(true);
  });

  it.each([
    null,
    'x',
    {},
    { meta: { schema: 2 }, frames: [] },
    { meta: { schema: 1 }, frames: [{}] },
  ])('từ chối dữ liệu sai: %j', (input) => {
    expect(isFixture(input)).toBe(false);
  });
});