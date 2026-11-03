import { disguise } from './anti-detect';

/**
 * Pause Guard — Bẫy HTMLMediaElement.prototype.pause trong MAIN world.
 *
 * Mục tiêu:
 * - Khi video đang nạp hoặc trong 2 giây đầu, YouTube Player liên tục gọi video.pause() ngầm
 *   để chờ ad placement và tạo độ trễ nhân tạo 4-5s.
 * - Ta chặn đứng lệnh pause() ngầm này nếu KHÔNG CÓ tương tác thật từ người dùng
 *   (click chuột, chạm màn hình, phím Space/K).
 * - Khi người dùng bấm tạm dừng thật sự, cho phép pause() chạy bình thường 100%.
 */

let _lastUserPauseGestureAt = 0;
const USER_GESTURE_WINDOW_MS = 800; // Tương tác người dùng có hiệu lực trong 800ms

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

  // 1. Lắng nghe cử chỉ người dùng có chủ ý tạm dừng
  const onPointerDown = (e: MouseEvent | PointerEvent) => {
    if (!e.isTrusted) return; // Bỏ qua synthetic click từ extension hoặc script
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Người dùng bấm vào nút Play/Pause của YouTube, bấm vào khung video hoặc container
    if (
      target.closest('.ytp-play-button') ||
      target.closest('.html5-video-player') ||
      target.tagName === 'VIDEO'
    ) {
      markUserPauseGesture();
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!e.isTrusted) return;
    // Phím Space (32) hoặc phím 'k'/'K' (phím tắt mặc định pause của YouTube)
    if (e.code === 'Space' || e.key === ' ' || e.key === 'k' || e.key === 'K') {
      const activeEl = document.activeElement;
      // Tránh bắt nhầm khi người dùng đang gõ trong ô tìm kiếm / comment
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

  try {
    win.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    win.addEventListener('keydown', onKeyDown, { capture: true, passive: true });
  } catch {}

  // 2. Hook HTMLMediaElement.prototype.pause
  function patchedPause(this: HTMLMediaElement): void {
    const isYouTubeVideo =
      this.classList?.contains('html5-main-video') ||
      (typeof this.closest === 'function' && !!this.closest('#movie_player, .html5-video-player'));

    if (isYouTubeVideo) {
      // Kiểm tra xem có phải do người dùng thao tác thật không
      const isUserIntent = isRecentUserPauseGesture();

      // Nếu video đang trong giai đoạn nạp ban đầu (chưa phát được 2 giây hoặc đang load)
      // và KHÔNG PHẢI do người dùng bấm pause -> BỎ QUA lệnh pause ngầm của YouTube!
      const isInitialLoadingPhase = this.currentTime < 2.0;

      if (!isUserIntent && isInitialLoadingPhase) {
        // Tự động kích hoạt play tiếp tục nếu YouTube cố tình kìm hãm
        if (this.paused && !this.ended && this.readyState >= 2) {
          void this.play().catch(() => undefined);
        }
        return; // Bỏ qua không thực hiện origPause
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
