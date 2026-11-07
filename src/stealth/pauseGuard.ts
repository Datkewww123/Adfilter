import { disguise } from './anti-detect';

/**
 * Pause Guard — Bẫy HTMLMediaElement.prototype.pause trong MAIN world.
 *
 * Mục tiêu:
 * - Khi video đang nạp hoặc trong 2 giây đầu, YouTube Player liên tục gọi video.pause() ngầm
 *   để chờ ad placement và tạo độ trễ nhân tạo.
 * - Ta chặn đứng lệnh pause() ngầm này nếu KHÔNG CÓ tương tác thật từ người dùng
 *   (click chuột, chạm màn hình, phím Space/K).
 * - Nếu tại thời điểm YouTube gọi pause(), video chưa nạp xong (readyState < 2),
 *   ta đăng ký listener 'canplay' để gọi this.play() ngay khi media thực sự sẵn sàng.
 * - Với Livestream (.ytp-live), không ép play() sớm ở mốc 0:00 để trình phát tự nhảy tới Live Edge.
 */

let _lastUserPauseGestureAt = 0;
const USER_GESTURE_WINDOW_MS = 800;

export function markUserPauseGesture(): void {
  _lastUserPauseGestureAt = Date.now();
}

export function resetUserPauseGestureForTest(): void {
  _lastUserPauseGestureAt = 0;
}

export function isRecentUserPauseGesture(): boolean {
  return Date.now() - _lastUserPauseGestureAt <= USER_GESTURE_WINDOW_MS;
}

export function installPauseGuard(win: Window = window): void {
  const winAny = win as any;
  const mediaProto = winAny.HTMLMediaElement?.prototype;
  if (!mediaProto || !mediaProto.pause) return;

  const origPause = mediaProto.pause;

  const onPointerDown = (e: MouseEvent | PointerEvent) => {
    if (!e.isTrusted) return;
    const target = e.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;

    if (target.closest('.ytp-play-button')) {
      markUserPauseGesture();
      return;
    }

    const playerEl = target.closest('.html5-video-player, #movie_player');
    if (playerEl || target.tagName === 'VIDEO') {
      const vid =
        target.tagName === 'VIDEO'
          ? (target as HTMLVideoElement)
          : playerEl?.querySelector<HTMLVideoElement>('video');
      if (!vid || (!vid.paused && vid.currentTime > 0.2)) {
        markUserPauseGesture();
      }
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!e.isTrusted) return;
    if (e.code === 'Space' || e.key === ' ' || e.key === 'k' || e.key === 'K') {
      const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }
      markUserPauseGesture();
    }
  };

  const onNavigate = () => {
    _lastUserPauseGestureAt = 0;
  };

  try {
    win.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    win.addEventListener('keydown', onKeyDown, { capture: true, passive: true });
    win.addEventListener('yt-navigate-start', onNavigate, { capture: true, passive: true });
    win.addEventListener('yt-navigate-finish', onNavigate, { capture: true, passive: true });
  } catch {}

  function patchedPause(this: HTMLMediaElement): void {
    const playerOrMatched =
      typeof this.closest === 'function'
        ? this.closest('#movie_player, .html5-video-player')
        : null;
    const isYouTubeVideo = this.classList?.contains('html5-main-video') || !!playerOrMatched;

    if (isYouTubeVideo) {
      const isUserIntent = isRecentUserPauseGesture();
      const isLiveStream =
        playerOrMatched &&
        typeof playerOrMatched === 'object' &&
        (playerOrMatched as Element).classList?.contains?.('ytp-live');

      const isInitialLoadingPhase = this.currentTime < 2.0;

      if (!isUserIntent && isInitialLoadingPhase && !isLiveStream) {
        if (this.paused && !this.ended && this.readyState >= 2) {
          void this.play().catch(() => undefined);
        } else if (!this.ended && typeof this.addEventListener === 'function') {
          const resumeWhenReady = () => {
            if (isRecentUserPauseGesture() || this.ended) return;
            if (this.paused && this.readyState >= 2) {
              void this.play().catch(() => undefined);
            }
          };
          this.addEventListener('loadeddata', resumeWhenReady, { once: true });
          this.addEventListener('canplay', resumeWhenReady, { once: true });
        }
        return;
      }
    }

    return origPause.call(this);
  }

  disguise(patchedPause, origPause);

  try {
    Object.defineProperty(mediaProto, 'pause', {
      value: patchedPause,
      writable: true,
      configurable: true,
    });
  } catch {
    mediaProto.pause = patchedPause;
  }
}
