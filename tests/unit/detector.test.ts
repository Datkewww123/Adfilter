import { describe, expect, it } from 'vitest';
import {
  initialState,
  looksLikeAd,
  runDetector,
  step,
  type DetectorEvent,
  type DetectorState,
} from '../../src/core/detector';
import type { Signals } from '../../src/core/types';

const frame = (t: number, o: Partial<Signals> = {}): Signals => ({
  t,
  playerFound: true,
  adShowing: false,
  adOverlay: false,
  adBadge: false,
  skipVisible: false,
  duration: null,
  currentTime: null,
  paused: null,
  ...o,
});

const ad = (t: number) => frame(t, { adShowing: true, adOverlay: true });
const normal = (t: number) => frame(t);
const lost = (t: number) => frame(t, { playerFound: false });
const types = (events: DetectorEvent[]) => events.map((e) => e.type);

describe('detector: khởi đầu', () => {
  it('chưa thấy player thì giữ UNKNOWN và không phát gì', () => {
    const r = step(initialState, lost(0));
    expect(r.next.phase).toBe('UNKNOWN');
    expect(r.events).toEqual([]);
  });

  it('thấy player không quảng cáo thì sang NORMAL', () => {
    const r = step(initialState, normal(0));
    expect(r.next.phase).toBe('NORMAL');
    expect(r.events).toEqual([]);
  });

  it('trang tải giữa chừng quảng cáo thì AD_START ngay', () => {
    const r = step(initialState, ad(1000));
    expect(r.next.phase).toBe('AD');
    expect(r.events).toEqual([{ type: 'AD_START', at: 1000, emittedAt: 1000 }]);
  });
});

describe('detector: bắt đầu quảng cáo', () => {
  it('chỉ phát AD_START sau khi tín hiệu ổn định đủ lâu', () => {
    const ev = runDetector([normal(0), ad(100), ad(200), ad(300)]);
    expect(ev).toEqual([{ type: 'AD_START', at: 100, emittedAt: 300 }]);
  });

  it('bỏ qua nhấp nháy ngắn hơn ngưỡng bắt đầu', () => {
    expect(runDetector([normal(0), ad(100), normal(150), normal(400)])).toEqual([]);
  });
});

describe('detector: kết thúc quảng cáo', () => {
  it('chỉ phát AD_END sau khi tín hiệu biến mất đủ lâu', () => {
    const ev = runDetector([ad(0), ad(100), normal(200), normal(400), normal(700)]);
    expect(ev).toEqual([
      { type: 'AD_START', at: 0, emittedAt: 0 },
      { type: 'AD_END', at: 200, emittedAt: 700 },
    ]);
  });

  it('khoảng hở ngắn giữa hai quảng cáo không tách thành hai', () => {
    const ev = runDetector([ad(0), ad(500), normal(600), normal(700), ad(800), ad(1500)]);
    expect(types(ev)).toEqual(['AD_START']);
  });

  it('hai quảng cáo cách xa nhau cho START, END, START, END', () => {
    const ev = runDetector([
      ad(0),
      normal(1000),
      normal(1500),
      normal(2000),
      ad(3000),
      ad(3200),
      normal(4000),
      normal(4500),
    ]);
    expect(types(ev)).toEqual(['AD_START', 'AD_END', 'AD_START', 'AD_END']);
  });

  it('mất player giữa quảng cáo thì kết thúc quảng cáo sau ngưỡng', () => {
    const ev = runDetector([ad(0), lost(100), lost(300), lost(600)]);
    expect(types(ev)).toEqual(['AD_START', 'AD_END']);
  });
});

describe('detector: điểm số tín hiệu', () => {
  it('lớp phủ cộng huy hiệu vẫn nhận ra khi class bị đổi tên', () => {
    expect(looksLikeAd(frame(0, { adOverlay: true, adBadge: true }))).toBe(true);
  });

  it('chỉ có huy hiệu thì chưa đủ', () => {
    expect(looksLikeAd(frame(0, { adBadge: true }))).toBe(false);
  });

  it('không có player thì không bao giờ là quảng cáo', () => {
    expect(looksLikeAd(lost(0))).toBe(false);
  });
});

describe('detector: tính thuần', () => {
  it('step không sửa đối tượng trạng thái đầu vào', () => {
    const prev: DetectorState = { phase: 'NORMAL', pendingSince: null };
    const copy = structuredClone(prev);
    step(prev, ad(0));
    expect(prev).toEqual(copy);
  });
});