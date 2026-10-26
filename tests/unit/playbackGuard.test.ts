import { describe, expect, it } from 'vitest';
import { isStuck } from '../../src/core/playbackGuard';
import type { Signals } from '../../src/core/types';

const s = (t: number, o: Partial<Signals> = {}): Signals => ({
  t,
  playerFound: true,
  adShowing: false,
  adOverlay: false,
  adBadge: false,
  skipVisible: false,
  duration: 600,
  currentTime: 10,
  paused: false,
  ...o,
});

describe('isStuck', () => {
  it('đang phát mà thời gian đứng yên sau 3s -> kẹt', () => {
    expect(isStuck(s(0), s(3000))).toBe(true);
  });

  it('thời gian vẫn tiến -> không kẹt', () => {
    expect(isStuck(s(0), s(3000, { currentTime: 13 }))).toBe(false);
  });

  it('người dùng tự tạm dừng -> không kẹt', () => {
    expect(isStuck(s(0), s(3000, { paused: true }))).toBe(false);
  });

  it('khoảng cách thời gian quá ngắn (< 2s) -> không kết luận', () => {
    expect(isStuck(s(0), s(1000))).toBe(false);
  });

  it('thiếu dữ liệu thời gian (null) -> không kết luận', () => {
    expect(isStuck(s(0, { currentTime: null }), s(3000))).toBe(false);
  });
});