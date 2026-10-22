import { describe, expect, it } from 'vitest';
import { runDetector } from '../../src/core/detector';
import type { Signals } from '../../src/core/types';

const frame = (t: number, ad: boolean): Signals => ({
  t,
  playerFound: true,
  adShowing: ad,
  adOverlay: ad,
  adBadge: false,
  skipVisible: false,
  duration: null,
  currentTime: null,
  paused: null,
});

describe('detector: cấu hình ngưỡng', () => {
  it('start bằng 0 thì nhận ra ngay khung đầu tiên có quảng cáo', () => {
    const ev = runDetector([frame(0, false), frame(100, true)], {
      startDebounceMs: 0,
      endDebounceMs: 400,
    });
    expect(ev).toEqual([{ type: 'AD_START', at: 100, emittedAt: 100 }]);
  });

  it('end rất lớn thì gộp cả khoảng hở dài', () => {
    const ev = runDetector(
      [
        frame(0, true),
        frame(500, false),
        frame(1000, false),
        frame(1200, true),
        frame(1300, true),
      ],
      { startDebounceMs: 150, endDebounceMs: 2000 },
    );
    expect(ev.map((e) => e.type)).toEqual(['AD_START']);
  });

  it('mặc định giữ nguyên hành vi cũ', () => {
    const frames = [frame(0, false), frame(100, true), frame(200, true), frame(300, true)];
    expect(runDetector(frames)).toEqual(
      runDetector(frames, { startDebounceMs: 150, endDebounceMs: 400 }),
    );
  });
});