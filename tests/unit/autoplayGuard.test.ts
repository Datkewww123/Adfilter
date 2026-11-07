import { describe, expect, it } from 'vitest';
import {
  inspectLiveEdge,
  isLivePlayback,
  isYouTubeLivePlayer,
  seekToLiveEdge,
  shouldAttemptAutoplay,
  shouldCorrectLiveRewind,
  shouldSeekToLiveEdge,
  type AutoplaySnapshot,
} from '../../src/core/autoplayGuard';

const base: AutoplaySnapshot = {
  paused: true,
  ended: false,
  readyState: 4,
  isAd: false,
  alreadyPlayed: false,
  now: 1_000,
  deadline: 2_000,
};

function liveVideo(currentTime: number, edge: number) {
  return {
    currentTime,
    seekable: {
      length: 1,
      start: () => 0,
      end: () => edge,
    },
  };
}

describe('shouldAttemptAutoplay', () => {
  it('cho phép tự phát khi video đã sẵn sàng và đang pause', () => {
    expect(shouldAttemptAutoplay(base)).toBe(true);
  });

  it('cho phép phát khi media có dữ liệu hiện tại (readyState >= 2)', () => {
    expect(shouldAttemptAutoplay({ ...base, readyState: 1 })).toBe(false);
    expect(shouldAttemptAutoplay({ ...base, readyState: 2 })).toBe(true);
    expect(shouldAttemptAutoplay({ ...base, readyState: 3 })).toBe(true);
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

  it('chỉ tự phát livestream khi đã ở sát live edge', () => {
    expect(shouldAttemptAutoplay({ ...base, isLive: true, atLiveEdge: false })).toBe(false);
    expect(shouldAttemptAutoplay({ ...base, isLive: true, atLiveEdge: true })).toBe(true);
  });
});

describe('shouldSeekToLiveEdge', () => {
  it('yêu cầu tua tới live edge khi livestream đang pause ở đầu DVR', () => {
    expect(
      shouldSeekToLiveEdge({
        ...base,
        isLive: true,
        atLiveEdge: false,
        canSeekLive: true,
        currentTime: 0,
      }),
    ).toBe(true);
  });

  it('không tua khi livestream đã ở live edge hoặc không đọc được seekable', () => {
    expect(
      shouldSeekToLiveEdge({ ...base, isLive: true, atLiveEdge: true, canSeekLive: true }),
    ).toBe(false);
    expect(
      shouldSeekToLiveEdge({ ...base, isLive: true, atLiveEdge: false, canSeekLive: false }),
    ).toBe(false);
  });
});

describe('shouldCorrectLiveRewind', () => {
  it('sửa livestream bị phát lại từ đầu ngay cả khi video đang chạy', () => {
    expect(
      shouldCorrectLiveRewind({
        ...base,
        paused: false,
        isLive: true,
        atLiveEdge: false,
        canSeekLive: true,
        currentTime: 0,
      }),
    ).toBe(true);
  });

  it('không can thiệp khi người dùng đã tua xa khỏi mốc 0', () => {
    expect(
      shouldCorrectLiveRewind({
        ...base,
        isLive: true,
        atLiveEdge: false,
        canSeekLive: true,
        currentTime: 30,
      }),
    ).toBe(false);
  });
});

describe('isLivePlayback & isYouTubeLivePlayer', () => {
  it('không coi video thường chưa nạp duration là livestream', () => {
    expect(isLivePlayback({ duration: 0 })).toBe(false);
    expect(isLivePlayback({ duration: Number.NaN })).toBe(false);
  });

  it('không coi video VOD có duration hữu hạn là livestream', () => {
    expect(isLivePlayback({ duration: 600 })).toBe(false);
  });

  it('nhận diện livestream qua duration Infinity hoặc cờ isLiveDom', () => {
    expect(isLivePlayback({ duration: Infinity })).toBe(true);
    expect(isLivePlayback({ duration: 3600, isLiveDom: true })).toBe(true);
  });

  it('nhận diện livestream qua class ytp-live hoặc API getVideoData().isLive', () => {
    const liveClassPlayer = {
      classList: { contains: (cls: string) => cls === 'ytp-live' },
    } as unknown as Element;
    expect(isYouTubeLivePlayer(liveClassPlayer)).toBe(true);

    const apiLivePlayer = {
      classList: { contains: () => false },
      getVideoData: () => ({ isLive: true }),
    } as unknown as Element;
    expect(isYouTubeLivePlayer(apiLivePlayer)).toBe(true);

    const vodPlayer = {
      classList: { contains: () => false },
      getVideoData: () => ({ isLive: false }),
    } as unknown as Element;
    expect(isYouTubeLivePlayer(vodPlayer)).toBe(false);
  });

  it('không coi bản ghi live đã kết thúc (isLiveContent) là livestream', () => {
    const replayPlayer = {
      classList: { contains: () => false },
      getVideoData: () => ({ isLive: false }),
      getPlayerResponse: () => ({ videoDetails: { isLiveContent: true } }),
    } as unknown as Element;
    expect(isYouTubeLivePlayer(replayPlayer)).toBe(false);
  });
});

describe('live edge helpers', () => {
  it('tính đúng khoảng cách tới live edge', () => {
    expect(inspectLiveEdge(liveVideo(98, 100))).toMatchObject({
      atLiveEdge: true,
      canSeek: true,
      edge: 100,
      distance: 2,
    });
    expect(inspectLiveEdge(liveVideo(10, 100))).toMatchObject({
      atLiveEdge: false,
      canSeek: true,
      distance: 90,
    });
  });

  it('tua tới sát live edge và không tua lặp lại khi đã ở đó', () => {
    const video = liveVideo(0, 100);
    expect(seekToLiveEdge(video)).toBe(true);
    expect(video.currentTime).toBe(99.5);
    expect(seekToLiveEdge(video)).toBe(false);
  });

  it('tuyệt đối không tua video VOD có duration hữu hạn khi không có cờ forceLive', () => {
    const video = { ...liveVideo(0, 100), duration: 100 };
    expect(seekToLiveEdge(video)).toBe(false);
    expect(video.currentTime).toBe(0);
  });

  it('cho phép tua Livestream có DVR (duration hữu hạn) tới live edge khi forceLive = true', () => {
    const dvrLiveVideo = { ...liveVideo(0, 7200), duration: 7200 };
    expect(seekToLiveEdge(dvrLiveVideo, true)).toBe(true);
    expect(dvrLiveVideo.currentTime).toBe(7199.5);
  });

  it('không tua video chưa rõ duration (0/NaN) vì có thể là VOD đang load', () => {
    const zero = { ...liveVideo(0, 100), duration: 0 };
    expect(seekToLiveEdge(zero)).toBe(false);
    expect(zero.currentTime).toBe(0);

    const nan = { ...liveVideo(0, 100), duration: Number.NaN };
    expect(seekToLiveEdge(nan)).toBe(false);
    expect(nan.currentTime).toBe(0);
  });

  it('chỉ tua khi duration xác nhận livestream (Infinity)', () => {
    const video = { ...liveVideo(0, 100), duration: Infinity };
    expect(seekToLiveEdge(video)).toBe(true);
    expect(video.currentTime).toBe(99.5);
  });
});
