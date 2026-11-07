import { disguise } from './anti-detect';

/**
 * Pause Guard — Bẫy HTMLMediaElement.prototype.pause trong MAIN world.
 *
 * Mục tiêu:
 * - Khi video đang nạp hoặc trong 2 giây đầu, YouTube Player liên tục gọi video.pause() ngầm
 *   để chờ ad placement và tạo độ trễ nhân tạo 4-5s.
 * - Ta chặn đứng lệnh pause() ngầm này nếu KHÔNG CÓ tương tác thật từ người dùng
 *   (click chuột, chạm màn hình, phím Space/K).
 * - Nếu tại thời điểm YouTube gọi pause(), video chưa nạp xong (readyState < 2),
 *   ta tự động đăng ký listener 'loadeddata'/'canplay' để gọi playVideo()/play() ngay khi có frame đầu.
 * - Với Livestream (.ytp-live), không ép play() sớm ở mốc 0:00 để trình phát nhảy thẳng tới Live Edge.
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
    if (!target || typeof target.closest !== 'function') return;

    // Nếu người dùng bấm trực tiếp vào nút Play/Pause thì luôn ghi nhận
    if (target.closest('.ytp-play-button')) {
      markUserPauseGesture();
      return;
    }

    // Nếu bấm vào khung video, chỉ ghi nhận là cử chỉ Pause khi video đã thực sự đang phát
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
    // Phím Space (32) hoặc phím 'k'/'K' (phím tắt mặc định pause của YouTube)
    if (e.code === 'Space' || e.key === ' ' || e.key === 'k' || e.key === 'K') {
      const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
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

  const onNavigate = () => {
    // Khi bắt đầu chuyển video mới, xóa dấu vết click chọn video trước đó
    _lastUserPauseGestureAt = 0;
  };

  try {
    win.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    win.addEventListener('keydown', onKeyDown, { capture: true, passive: true });
    win.addEventListener('yt-navigate-start', onNavigate, { capture: true, passive: true });
    win.addEventListener('yt-navigate-finish', onNavigate, { capture: true, passive: true });
  } catch {}

  // 2. Hook HTMLMediaElement.prototype.pause
  function patchedPause(this: HTMLMediaElement): void {
    const playerOrMatched =
      typeof this.closest === 'function'
        ? this.closest('#movie_player, .html5-video-player')
        : null;
    const isYouTubeVideo = this.classList?.contains('html5-main-video') || !!playerOrMatched;

    if (isYouTubeVideo) {
      // Kiểm tra xem có phải do người dùng thao tác thật không
      const isUserIntent = isRecentUserPauseGesture();

      // Kiểm tra nếu đây là Livestream: không chặn/ép play ở 0:00 để YouTube tự seek tới Live Edge
      const isLiveStream =
        playerOrMatched &&
        typeof playerOrMatched === 'object' &&
        (playerOrMatched as Element).classList?.contains?.('ytp-live');

      // Nếu video VOD đang trong giai đoạn nạp ban đầu (chưa phát được 2 giây hoặc đang load)
      // và KHÔNG PHẢI do người dùng bấm pause -> BỎ QUA lệnh pause ngầm của YouTube!
      const isInitialLoadingPhase = this.currentTime < 2.0;

      if (!isUserIntent && isInitialLoadingPhase && !isLiveStream) {
        // Tự động kích hoạt play tiếp tục nếu đã có dữ liệu (readyState >= 2)
        if (this.paused && !this.ended && this.readyState >= 2) {
          void this.play().catch(() => undefined);
        } else if (!this.ended && typeof this.addEventListener === 'function') {
          // Nếu YouTube gọi pause() khi video còn đang nạp (readyState < 2),
          // đặt hẹn giờ & listener để kích hoạt phát ngay khi nạp xong frame đầu tiên
          const resumeWhenReady = () => {
            if (isRecentUserPauseGesture() || this.ended) return;
            if (
              playerOrMatched &&
              typeof playerOrMatched === 'object' &&
              typeof (playerOrMatched as any).playVideo === 'function'
            ) {
              try {
                (playerOrMatched as any).playVideo();
              } catch {}
            }
            if (this.paused) {
              void this.play().catch(() => undefined);
            }
          };
          this.addEventListener('loadeddata', resumeWhenReady, { once: true });
          this.addEventListener('canplay', resumeWhenReady, { once: true });
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
