/**
 * Pause Guard — CHỈ theo dõi cử chỉ Play/Pause thật của người dùng.
 *
 * Lịch sử: bản cũ bẫy HTMLMediaElement.prototype.pause để nuốt lệnh pause() của YouTube
 * và tự gọi video.play(). Việc đó làm trạng thái nội bộ của YouTube Player lệch với thẻ
 * <video> → nút Play/Pause bị kẹt, video đứng ở trạng thái pause khi đang load.
 * Từ nay module này KHÔNG can thiệp vào pause()/play() nữa; mọi lệnh phát đều đi qua
 * API của player (player.playVideo()) trong defuser.ts.
 */

let _lastUserGestureAt = 0;
const USER_GESTURE_WINDOW_MS = 1000;

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
    // Mọi cú bấm vào player (nút Play, khung video, thanh điều khiển) đều là ý muốn của người dùng
    if (
      target.closest('.ytp-play-button, #movie_player, .html5-video-player') ||
      target.tagName === 'VIDEO'
    ) {
      markUserPauseGesture();
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!e.isTrusted) return;
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
    _lastUserGestureAt = 0;
  };

  try {
    win.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    win.addEventListener('keydown', onKeyDown, { capture: true, passive: true });
    win.addEventListener('yt-navigate-start', onNavigate, { capture: true, passive: true });
  } catch {}
}
