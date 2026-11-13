import { disguise } from './anti-detect';
import { isSuspiciousUrl } from './urlBlockRegistry';

export { isSuspiciousUrl };

export interface AntiPopupOptions {
  onBlocked?: (url: string) => void;
}

let lastUserClickTime = 0;

// Ghi nhận tương tác chuột của người dùng
export function trackUserGesture(targetWindow: Window = window): void {
  try {
    targetWindow.addEventListener(
      'pointerdown',
      () => {
        lastUserClickTime = Date.now();
      },
      { capture: true, passive: true }
    );
  } catch {
    // Bỏ qua lỗi context
  }
}

export function isUserGestureRecent(thresholdMs: number = 1000): boolean {
  return Date.now() - lastUserClickTime <= thresholdMs;
}

function installSyntheticAnchorTrap(
  targetWindow: Window,
  options: AntiPopupOptions
): void {
  const anchorProto = (targetWindow as unknown as { HTMLAnchorElement?: typeof HTMLAnchorElement })
    .HTMLAnchorElement?.prototype;
  const originalAnchorClick = anchorProto?.click;
  if (!anchorProto || !originalAnchorClick) return;

  const patchedAnchorClick = function (this: HTMLAnchorElement): void {
    const target = this.getAttribute('target') || this.target || '';
    const href = this.href || this.getAttribute('href') || '';
    if (target.toLowerCase() === '_blank' && (isSuspiciousUrl(href) || !isUserGestureRecent(1000))) {
      options.onBlocked?.(href);
      return;
    }
    return originalAnchorClick.call(this);
  };

  disguise(
    patchedAnchorClick as (...args: unknown[]) => unknown,
    originalAnchorClick as (...args: unknown[]) => unknown
  );
  anchorProto.click = patchedAnchorClick;
}

export function installAntiPopup(targetWindow: Window = window, options: AntiPopupOptions = {}): void {
  const originalOpen = targetWindow.open;
  if (!originalOpen) return;

  trackUserGesture(targetWindow);
  installSyntheticAnchorTrap(targetWindow, options);

  function patchedOpen(
    this: Window,
    url?: string | URL,
    target?: string,
    features?: string
  ): WindowProxy | null {
    const urlString = url ? String(url) : '';

    // 1. Nếu mở không có tương tác người dùng trong 1000ms qua -> Chặn tuyệt đối
    if (!isUserGestureRecent(1000)) {
      options.onBlocked?.(urlString);
      return null;
    }

    // 2. Nếu URL chứa từ khóa quảng cáo/cờ bạc/cloaked redirector -> Chặn
    if (isSuspiciousUrl(urlString)) {
      options.onBlocked?.(urlString);
      return null;
    }

    // 3. Cho phép các thao tác mở tab hợp lệ của người dùng
    return originalOpen.call(this, url, target, features);
  }

  disguise(patchedOpen, originalOpen);
  targetWindow.open = patchedOpen;
}
