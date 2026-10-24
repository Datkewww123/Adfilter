import { describe, expect, it } from 'vitest';
import { plan, type PlanContext } from '../../src/core/intervention';
import { defaultConfig, type Config } from '../../src/storage/config';

const live: Config = { ...defaultConfig, dryRun: false };

const ctx = (o: Partial<PlanContext> = {}): PlanContext => ({
  inAd: true,
  msIntoAd: 0,
  skipVisible: false,
  done: [],
  ...o,
});

describe('plan', () => {
  it('không làm gì khi đã tắt bằng công tắc', () => {
    expect(plan(ctx(), { ...live, enabled: false })).toEqual([]);
  });

  it('không làm gì khi không ở trong quảng cáo', () => {
    expect(plan(ctx({ inAd: false, skipVisible: true }), live)).toEqual([]);
  });

  it('có nút bỏ qua thì bấm nút', () => {
    expect(plan(ctx({ skipVisible: true }), live)).toEqual([{ type: 'CLICK_SKIP' }]);
  });

  it('không có nút thì tắt tiếng và tăng tốc theo cấu hình', () => {
    expect(plan(ctx(), { ...live, maxSpeed: 3 })).toEqual([
      { type: 'MUTE_SPEEDUP', speed: 3 },
    ]);
  });

  it('đã làm rồi thì không lặp lại', () => {
    expect(plan(ctx({ done: ['MUTE_SPEEDUP'] }), live)).toEqual([]);
    expect(plan(ctx({ skipVisible: true, done: ['CLICK_SKIP'] }), live)).toEqual([]);
  });

  it('nút bỏ qua hiện sau khi đã tắt tiếng vẫn bấm nút', () => {
    const c = ctx({ skipVisible: true, done: ['MUTE_SPEEDUP'] });
    expect(plan(c, live)).toEqual([{ type: 'CLICK_SKIP' }]);
  });

  it('mặc định không bao giờ tua', () => {
    const out = plan(ctx({ msIntoAd: 60_000 }), live);
    expect(out.some((a) => a.type === 'SEEK_TO_END')).toBe(false);
  });

  it('tua chỉ khi được bật và đã đợi đủ lâu', () => {
    const cfg = { ...live, allowSeek: true };
    expect(plan(ctx({ msIntoAd: 1000, done: ['MUTE_SPEEDUP'] }), cfg)).toEqual([]);
    expect(plan(ctx({ msIntoAd: 2000, done: ['MUTE_SPEEDUP'] }), cfg)).toEqual([
      { type: 'SEEK_TO_END' },
    ]);
  });
});