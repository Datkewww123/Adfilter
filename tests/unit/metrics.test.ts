import { describe, expect, it } from 'vitest';
import type { DetectorEvent } from '../../src/core/detector';
import {
  add,
  compare,
  detectedIntervals,
  emptyCounts,
  median,
  rates,
} from '../../src/core/metrics';

const start = (at: number, emittedAt = at): DetectorEvent => ({
  type: 'AD_START',
  at,
  emittedAt,
});
const end = (at: number, emittedAt = at): DetectorEvent => ({
  type: 'AD_END',
  at,
  emittedAt,
});
const di = (s: number, e: number, emittedAt = s) => ({ start: s, end: e, emittedAt });

describe('detectedIntervals', () => {
  it('ghép START với END', () => {
    expect(detectedIntervals([start(100, 250), end(900, 1300)], 2000)).toEqual([
      { start: 100, end: 900, emittedAt: 250 },
    ]);
  });

  it('quảng cáo chưa kết thúc được đóng ở frame cuối', () => {
    expect(detectedIntervals([start(100)], 2000)).toEqual([
      { start: 100, end: 2000, emittedAt: 100 },
    ]);
  });

  it('bỏ qua END không có START', () => {
    expect(detectedIntervals([end(100)], 2000)).toEqual([]);
  });
});

describe('compare', () => {
  it('khớp hoàn hảo', () => {
    const c = compare([{ start: 100, end: 900 }], [di(100, 900, 250)]);
    expect([c.tp, c.fp, c.fn, c.merged]).toEqual([1, 0, 0, 0]);
    expect(c.latencies).toEqual([150]);
  });

  it('phát hiện mà không có nhãn là dương tính giả', () => {
    const c = compare([], [di(100, 900)]);
    expect([c.tp, c.fp, c.fn]).toEqual([0, 1, 0]);
  });

  it('có nhãn mà không có phát hiện là âm tính giả', () => {
    const c = compare([{ start: 100, end: 900 }], []);
    expect([c.tp, c.fp, c.fn]).toEqual([0, 0, 1]);
  });

  it('một phát hiện phủ hai nhãn tính là gộp', () => {
    const truth = [
      { start: 100, end: 300 },
      { start: 500, end: 700 },
    ];
    const c = compare(truth, [di(100, 700)]);
    expect([c.tp, c.fp, c.fn, c.merged]).toEqual([1, 0, 0, 1]);
  });

  it('nhãn bấm trễ vẫn khớp, labelLag âm', () => {
    const c = compare([{ start: 600, end: 5000 }], [di(100, 4800, 250)]);
    expect(c.tp).toBe(1);
    expect(c.labelLags).toEqual([-350]);
  });
});

describe('rates', () => {
  it('tính precision, recall, f1', () => {
    const c = { ...emptyCounts(), tp: 8, fp: 2, fn: 2 };
    const r = rates(c);
    expect(r.precision).toBeCloseTo(0.8);
    expect(r.recall).toBeCloseTo(0.8);
    expect(r.f1).toBeCloseTo(0.8);
  });

  it('trả null khi mẫu số bằng 0', () => {
    expect(rates(emptyCounts())).toEqual({ precision: null, recall: null, f1: null });
  });
});

describe('median', () => {
  it('rỗng thì null', () => expect(median([])).toBeNull());
  it('lẻ phần tử', () => expect(median([3, 1, 2])).toBe(2));
  it('chẵn phần tử', () => expect(median([1, 2, 3, 4])).toBe(2.5));
});

describe('add', () => {
  it('cộng số đếm và nối mảng', () => {
    const a = { ...emptyCounts(), tp: 1, latencies: [10] };
    const b = { ...emptyCounts(), tp: 2, fp: 1, latencies: [20] };
    const s = add(a, b);
    expect([s.tp, s.fp]).toEqual([3, 1]);
    expect(s.latencies).toEqual([10, 20]);
  });
});