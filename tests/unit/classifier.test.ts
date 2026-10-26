import { describe, expect, it } from 'vitest';
import { classify, endObservation, newObservation, observeAd } from '../../src/core/classifier';
import type { Signals } from '../../src/core/types';

const sig = (t: number, o: Partial<Signals> = {}): Signals => ({
  t,
  playerFound: true,
  adShowing: true,
  adOverlay: true,
  adBadge: true,
  skipVisible: false,
  duration: 15,
  currentTime: 0,
  paused: false,
  ...o,
});

describe('classifier', () => {
  it('mới bắt đầu thì chưa rõ, độ tự tin thấp', () => {
    const c = classify(newObservation(0));
    expect(c.kind).toBe('UNKNOWN');
    expect(c.confidence).toBeLessThan(0.5);
  });

  it('thấy nút bỏ qua thì SKIPPABLE', () => {
    const o = observeAd(newObservation(0), sig(5000, { skipVisible: true }));
    expect(classify(o).kind).toBe('SKIPPABLE');
  });

  it('hết mà chưa từng thấy nút thì NON_SKIPPABLE (tin cậy vừa)', () => {
    const o = endObservation(observeAd(newObservation(0), sig(1000)), 15000);
    const c = classify(o);
    expect(c.kind).toBe('NON_SKIPPABLE');
    expect(c.confidence).toBeLessThan(0.9);
  });

  it('bộ đếm nhiều hơn một quảng cáo thì SEQUENCE, ưu tiên hơn các loại khác', () => {
    const o = observeAd(
      newObservation(0),
      sig(1000, { adBadgeText: 'Ad 1 of 2', skipVisible: true }),
    );
    expect(classify(o).kind).toBe('SEQUENCE');
  });

  it('giữ bộ đếm đã thấy dù frame sau không còn chữ', () => {
    let o = observeAd(newObservation(0), sig(1000, { adBadgeText: 'Ad 1 of 2' }));
    o = observeAd(o, sig(2000, { adBadgeText: null }));
    expect(o.counter).toEqual({ index: 1, total: 2 });
  });

  it('observeAd không sửa đối tượng cũ', () => {
    const a = newObservation(0);
    observeAd(a, sig(1000, { skipVisible: true }));
    expect(a.skipSeen).toBe(false);
  });
});