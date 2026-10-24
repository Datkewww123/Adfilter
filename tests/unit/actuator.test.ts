import { describe, expect, it } from 'vitest';
import { Actuator, type VideoLike } from '../../src/content/actuator';

const makeVideo = (o: Partial<VideoLike> = {}): VideoLike => ({
  muted: false,
  playbackRate: 1.5,
  currentTime: 0,
  duration: 30,
  ...o,
});

const make = (video: VideoLike | null, clicked = true) =>
  new Actuator({ getVideo: () => video, clickSkip: () => clicked });

describe('Actuator', () => {
  it('không có baseline thì không tắt tiếng (skipped)', () => {
    const v = makeVideo();
    const r = make(v).apply({ type: 'MUTE_SPEEDUP', speed: 2 });
    expect(r).toMatchObject({ ok: false, skipped: true });
    expect(v.muted).toBe(false);
  });

  it('tắt tiếng, đổi tốc độ rồi khôi phục đúng giá trị của người dùng', () => {
    const v = makeVideo({ muted: false, playbackRate: 1.5 });
    const a = make(v);
    a.noteBaseline();
    expect(a.apply({ type: 'MUTE_SPEEDUP', speed: 2 })).toEqual({ ok: true });
    expect([v.muted, v.playbackRate]).toEqual([true, 2]);
    a.restore();
    expect([v.muted, v.playbackRate]).toEqual([false, 1.5]);
  });

  it('giữ đúng trạng thái tắt tiếng sẵn có của người dùng', () => {
    const v = makeVideo({ muted: true, playbackRate: 1 });
    const a = make(v);
    a.noteBaseline();
    a.apply({ type: 'MUTE_SPEEDUP', speed: 2 });
    a.restore();
    expect(v.muted).toBe(true);
  });

  it('noteBaseline không ghi đè khi đang can thiệp', () => {
    const v = makeVideo({ muted: false, playbackRate: 1.5 });
    const a = make(v);
    a.noteBaseline();
    a.apply({ type: 'MUTE_SPEEDUP', speed: 2 });
    a.noteBaseline();
    a.restore();
    expect([v.muted, v.playbackRate]).toEqual([false, 1.5]);
  });

  it('restore khi chưa can thiệp thì không đổi gì', () => {
    const v = makeVideo({ muted: true, playbackRate: 3 });
    const a = make(v);
    a.noteBaseline();
    a.restore();
    expect([v.muted, v.playbackRate]).toEqual([true, 3]);
  });

  it('CLICK_SKIP phản ánh kết quả bấm nút', () => {
    expect(make(makeVideo(), true).apply({ type: 'CLICK_SKIP' }).ok).toBe(true);
    expect(make(makeVideo(), false).apply({ type: 'CLICK_SKIP' }).ok).toBe(false);
  });

  it('SEEK_TO_END đưa tới gần cuối, và báo lỗi khi không biết độ dài', () => {
    const v = makeVideo({ duration: 30 });
    expect(make(v).apply({ type: 'SEEK_TO_END' }).ok).toBe(true);
    expect(v.currentTime).toBeCloseTo(29.9);
    expect(make(makeVideo({ duration: Number.NaN })).apply({ type: 'SEEK_TO_END' }).ok).toBe(false);
  });

  it('bắt lỗi ném ra và trả về ok false', () => {
    const a = new Actuator({
      getVideo: () => {
        throw new Error('boom');
      },
      clickSkip: () => true,
    });
    expect(a.apply({ type: 'SEEK_TO_END' })).toEqual({ ok: false, error: 'boom' });
  });
});