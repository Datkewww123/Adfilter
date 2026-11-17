import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  installPauseGuard,
  isRecentUserPauseGesture,
  markUserPauseGesture,
  resetUserPauseGestureForTest,
} from '../../src/stealth/pauseGuard';

describe('PauseGuard (chỉ theo dõi cử chỉ người dùng)', () => {
  let fakeWindow: any;
  let origPause: any;

  beforeEach(() => {
    resetUserPauseGestureForTest();
    origPause = vi.fn();
    fakeWindow = {
      HTMLMediaElement: { prototype: { pause: origPause } },
      addEventListener: vi.fn(),
    };
  });

  it('chưa có cử chỉ thì không coi là người dùng vừa bấm', () => {
    expect(isRecentUserPauseGesture()).toBe(false);
  });

  it('nhận diện cử chỉ người dùng vừa diễn ra', () => {
    markUserPauseGesture();
    expect(isRecentUserPauseGesture()).toBe(true);
  });

  it('cử chỉ hết hiệu lực sau khoảng thời gian chờ', () => {
    vi.useFakeTimers();
    markUserPauseGesture();
    vi.advanceTimersByTime(1500);
    expect(isRecentUserPauseGesture()).toBe(false);
    expect(isRecentUserPauseGesture(10_000)).toBe(true);
    vi.useRealTimers();
  });

  it('KHÔNG bẫy HTMLMediaElement.prototype.pause (tránh lệch trạng thái player / kẹt nút)', () => {
    installPauseGuard(fakeWindow);
    expect(fakeWindow.HTMLMediaElement.prototype.pause).toBe(origPause);
  });

  it('đăng ký listener pointerdown và keydown để theo dõi cử chỉ', () => {
    installPauseGuard(fakeWindow);
    const events = fakeWindow.addEventListener.mock.calls.map((c: unknown[]) => c[0]);
    expect(events).toContain('pointerdown');
    expect(events).toContain('keydown');
  });

  it('bỏ qua click trên inline preview ngoài trang chủ để không chặn autoplay video đầu tiên', () => {
    installPauseGuard(fakeWindow);
    const pointerCall = fakeWindow.addEventListener.mock.calls.find(
      (c: unknown[]) => c[0] === 'pointerdown',
    );
    const onPointerDown = pointerCall[1] as (e: any) => void;

    const fakeVideo = { paused: false, currentTime: 2.5 };
    const fakePlayer = { querySelector: () => fakeVideo };

    onPointerDown({
      isTrusted: true,
      target: {
        tagName: 'VIDEO',
        closest: (selector: string) => {
          if (selector.includes('#inline-preview-player') || selector.includes('ytd-video-preview')) {
            return {};
          }
          if (selector.includes('.html5-video-player')) return fakePlayer;
          return null;
        },
      },
    });
    expect(isRecentUserPauseGesture()).toBe(false);
  });

  it('vẫn ghi nhận cử chỉ pause khi click trực tiếp vào #movie_player đang phát', () => {
    installPauseGuard(fakeWindow);
    const pointerCall = fakeWindow.addEventListener.mock.calls.find(
      (c: unknown[]) => c[0] === 'pointerdown',
    );
    const onPointerDown = pointerCall[1] as (e: any) => void;

    const fakeVideo = { paused: false, currentTime: 5.0 };
    const fakePlayer = { querySelector: () => fakeVideo };

    onPointerDown({
      isTrusted: true,
      target: {
        tagName: 'DIV',
        closest: (selector: string) => {
          if (selector.includes('#movie_player')) return fakePlayer;
          return null;
        },
      },
    });
    expect(isRecentUserPauseGesture()).toBe(true);
  });
});
