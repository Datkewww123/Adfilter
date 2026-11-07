import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  installPauseGuard,
  isRecentUserPauseGesture,
  markUserPauseGesture,
  resetUserPauseGestureForTest,
} from '../../src/stealth/pauseGuard';

describe('PauseGuard', () => {
  let fakeWindow: any;
  let origPauseMock: any;
  let fakeVideo: any;

  beforeEach(() => {
    resetUserPauseGestureForTest();
    origPauseMock = vi.fn();
    fakeVideo = {
      classList: {
        contains: (cls: string) => cls === 'html5-main-video',
      },
      closest: () => true,
      currentTime: 0.5,
      paused: true,
      ended: false,
      readyState: 4,
      play: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    };

    fakeWindow = {
      HTMLMediaElement: {
        prototype: {
          pause: origPauseMock,
        },
      },
      addEventListener: vi.fn(),
    };
  });

  it('nhận diện chính xác tương tác người dùng vừa diễn ra', () => {
    markUserPauseGesture();
    expect(isRecentUserPauseGesture()).toBe(true);
  });

  it('chặn lệnh pause ngầm của YouTube trong giai đoạn nạp ban đầu (currentTime < 2s)', () => {
    installPauseGuard(fakeWindow);
    const patchedPause = fakeWindow.HTMLMediaElement.prototype.pause;

    // Gọi pause không có tương tác người dùng
    patchedPause.call(fakeVideo);

    expect(origPauseMock).not.toHaveBeenCalled();
    expect(fakeVideo.play).toHaveBeenCalled();
  });

  it('đăng ký listener loadeddata/canplay để tự phát khi YouTube gọi pause lúc readyState < 2', () => {
    installPauseGuard(fakeWindow);
    const patchedPause = fakeWindow.HTMLMediaElement.prototype.pause;

    fakeVideo.readyState = 1;
    patchedPause.call(fakeVideo);

    expect(origPauseMock).not.toHaveBeenCalled();
    expect(fakeVideo.addEventListener).toHaveBeenCalledWith(
      'loadeddata',
      expect.any(Function),
      { once: true },
    );
    expect(fakeVideo.addEventListener).toHaveBeenCalledWith(
      'canplay',
      expect.any(Function),
      { once: true },
    );
  });

  it('không ép play ở mốc 0:00 trên Livestream (.ytp-live) để trình phát tự nhảy tới Live Edge', () => {
    installPauseGuard(fakeWindow);
    const patchedPause = fakeWindow.HTMLMediaElement.prototype.pause;

    fakeVideo.closest = () => ({
      classList: { contains: (cls: string) => cls === 'ytp-live' },
    });
    patchedPause.call(fakeVideo);

    expect(origPauseMock).toHaveBeenCalled();
    expect(fakeVideo.play).not.toHaveBeenCalled();
  });

  it('cho phép lệnh pause khi có tương tác người dùng thật', () => {
    installPauseGuard(fakeWindow);
    const patchedPause = fakeWindow.HTMLMediaElement.prototype.pause;

    markUserPauseGesture(); // Giả lập người dùng vừa click hoặc bấm phím
    patchedPause.call(fakeVideo);

    expect(origPauseMock).toHaveBeenCalled();
  });

  it('cho phép lệnh pause khi video đã phát qua 2 giây', () => {
    installPauseGuard(fakeWindow);
    const patchedPause = fakeWindow.HTMLMediaElement.prototype.pause;

    fakeVideo.currentTime = 5.0; // Video đã phát ổn định
    patchedPause.call(fakeVideo);

    expect(origPauseMock).toHaveBeenCalled();
  });
});
