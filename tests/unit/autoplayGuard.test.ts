import { describe, expect, it } from 'vitest';
import { shouldAttemptAutoplay, type AutoplaySnapshot } from '../../src/core/autoplayGuard';

const base: AutoplaySnapshot = {
  paused: true,
  ended: false,
  readyState: 4,
  isAd: false,
  alreadyPlayed: false,
  now: 1_000,
  deadline: 2_000,
};

describe('shouldAttemptAutoplay', () => {
  it('cho phép tự phát khi video đã sẵn sàng và đang pause', () => {
    expect(shouldAttemptAutoplay(base)).toBe(true);
  });

  it('chờ đến khi media có dữ liệu (readyState >= 2)', () => {
    expect(shouldAttemptAutoplay({ ...base, readyState: 1 })).toBe(false);
  });

  it('không can thiệp khi video đang phát', () => {
    expect(shouldAttemptAutoplay({ ...base, paused: false })).toBe(false);
  });

  it('không can thiệp khi video đã phát ổn định (người dùng tự pause)', () => {
    expect(shouldAttemptAutoplay({ ...base, alreadyPlayed: true })).toBe(false);
  });

  it('không can thiệp khi đang có quảng cáo', () => {
    expect(shouldAttemptAutoplay({ ...base, isAd: true })).toBe(false);
  });

  it('không can thiệp khi video đã kết thúc', () => {
    expect(shouldAttemptAutoplay({ ...base, ended: true })).toBe(false);
  });

  it('dừng thử sau thời hạn chờ', () => {
    expect(shouldAttemptAutoplay({ ...base, now: 2_001 })).toBe(false);
  });
});
