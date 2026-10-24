import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/core/intervention';
import { verifyAction } from '../../src/core/verify';
import type { Signals } from '../../src/core/types';

const sig = (o: Partial<Signals> = {}): Signals => ({
  t: 0,
  playerFound: true,
  adShowing: true,
  adOverlay: true,
  adBadge: false,
  skipVisible: false,
  duration: 30,
  currentTime: 1,
  paused: false,
  muted: false,
  playbackRate: 1,
  ...o,
});

const skip: Action = { type: 'CLICK_SKIP' };
const mute: Action = { type: 'MUTE_SPEEDUP', speed: 2 };
const seek: Action = { type: 'SEEK_TO_END' };

describe('verifyAction', () => {
  it('quảng cáo đã hết thì luôn hợp lệ', () => {
    for (const a of [skip, mute, seek]) {
      expect(verifyAction(a, sig({ adShowing: false }))).toBe(true);
    }
  });

  it('CLICK_SKIP: nút vẫn còn thì thất bại, nút đã mất thì đạt', () => {
    expect(verifyAction(skip, sig({ skipVisible: true }))).toBe(false);
    expect(verifyAction(skip, sig({ skipVisible: false }))).toBe(true);
  });

  it('MUTE_SPEEDUP: cần đã tắt tiếng và đúng tốc độ', () => {
    expect(verifyAction(mute, sig({ muted: true, playbackRate: 2 }))).toBe(true);
    expect(verifyAction(mute, sig({ muted: false, playbackRate: 2 }))).toBe(false);
    expect(verifyAction(mute, sig({ muted: true, playbackRate: 1 }))).toBe(false);
    expect(verifyAction(mute, sig({ muted: true, playbackRate: null }))).toBe(false);
  });

  it('SEEK_TO_END: cần đã gần hết quảng cáo', () => {
    expect(verifyAction(seek, sig({ currentTime: 29, duration: 30 }))).toBe(true);
    expect(verifyAction(seek, sig({ currentTime: 15, duration: 30 }))).toBe(false);
    expect(verifyAction(seek, sig({ duration: null }))).toBe(false);
  });
});