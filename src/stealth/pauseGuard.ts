/**
 * Pause Guard — CHỈ theo dõi cử chỉ Play/Pause thật của người dùng.
 *
 * Chỉ ghi nhận cử chỉ Pause khi:
 * 1. Bấm trực tiếp vào nút Play/Pause (.ytp-play-button).
 * 2. Click vào khung video KHI VIDEO ĐANG PHÁT THẬT (!video.paused && video.currentTime > 0.3).
 * 3. Phím Space hoặc phím K (ngoài input/textarea).
 * Tuyệt đối không ghi nhận khi video đang dừng/nạp trang để không chặn autoplay.
 */

let _lastUserGestureAt = 0;
const USER_GESTURE_WINDOW_MS = 1200;

export function markUserPauseGesture(): void {
  _lastUserGestureAt = Date.now();
}

export function resetUserPauseGestureForTest(): void {
  _lastUserGestureAt = 0;
}

/** Người dùng có vừa bấm Play/Pause (chuột/phím) trong khoảng windowMs gần đây không. */
export function isRecentUserPauseGesture(windowMs: number = USER_GESTURE_WINDOW_MS): boolean {
  return _lastUserGestureAt > 0 && Date.now() - _lastUserGestureAt <= windowMs;
}

export function installPauseGuard(win: Window = window): void {
  const onPointerDown = (e: MouseEvent | PointerEvent) => {
    if (!e.isTrusted) return;
    const target = e.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;

    // 1. Click trực tiếp vào nút Play/Pause
    if (target.closest('.ytp-play-button')) {
      markUserPauseGesture();
      return;
    }

    // 2. Click vào khung video: CHỈ tính là muốn Pause khi video ĐANG THẬT SỰ PHÁT
    const playerEl = target.closest('#movie_player, .html5-video-player');
    if (playerEl || target.tagName === 'VIDEO') {
      const vid =
        target.tagName === 'VIDEO'
          ? (target as HTMLVideoElement)
          : playerEl?.querySelector<HTMLVideoElement>('video');
      if (vid && !vid.paused && vid.currentTime > 0.3) {
        markUserPauseGesture();
      }
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!e.isTrusted) return;
    if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyK' || e.key === 'k' || e.key === 'K') {
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

  const onReset = () => {
    _lastUserGestureAt = 0;
  };

  try {
    win.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    win.addEventListener('keydown', onKeyDown, { capture: true, passive: true });
    win.addEventListener('yt-navigate-start', onReset, { capture: true, passive: true });
    win.addEventListener('yt-navigate-finish', onReset, { capture: true, passive: true });
  } catch {}
}
