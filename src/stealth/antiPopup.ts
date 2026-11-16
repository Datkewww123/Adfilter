import { disguise } from './anti-detect';
import { isSuspiciousUrl } from './urlBlockRegistry';

export { isSuspiciousUrl };

export interface AntiPopupOptions {
  onBlocked?: (url: string) => void;
}

interface ClickIntentContext {
  timestamp: number;
  isPlayerInteraction: boolean;
  clickedAnchorHref: string | null;
  clickedAnchorTarget: string;
}

let lastUserClickTime = 0;
let lastClickIntent: ClickIntentContext | null = null;

function isPlayerControlTarget(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'VIDEO') return true;
  return Boolean(
    el.closest?.(
      'video, .jwplayer, .video-js, .plyr, .art-video-player, [class*="player"], [id*="player"], [class*="play-btn"], button[aria-label*="play" i]'
    )
  );
}

// Ghi nhận tương tác chuột và ngữ cảnh phần tử thực tế mà người dùng vừa bấm
export function trackUserGesture(targetWindow: Window = window): void {
  try {
    targetWindow.addEventListener(
      'pointerdown',
      (e?: Event) => {
        const now = Date.now();
        lastUserClickTime = now;

        const target = (e?.target as Element | null) ?? null;
        if (!target || typeof target !== 'object') {
          lastClickIntent = null;
          return;
        }

        const anchor = typeof target.closest === 'function' ? target.closest('a[href]') : null;
        const rawHref = anchor?.getAttribute?.('href') || (anchor as HTMLAnchorElement | null)?.href || null;
        lastClickIntent = {
          timestamp: now,
          isPlayerInteraction: isPlayerControlTarget(target),
          clickedAnchorHref: rawHref,
          clickedAnchorTarget: (anchor?.getAttribute?.('target') || '').toLowerCase(),
        };
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

function tryParseUrl(raw: string, base?: string): URL | null {
  try {
    return base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
}

/**
 * Kiểm tra liệu lệnh mở popup/tab/redirect có đi ngược ý định click thật của người dùng hay không
 * (ví dụ: vừa bấm nút Play video hoặc bấm link nội bộ sang trang thông tin phim nhưng JS lại nhảy tab domain lạ).
 */
export function isUnintendedPopupAttempt(
  urlString: string,
  targetWindow: Window = window
): boolean {
  if (!isUserGestureRecent(1000)) return true;
  if (isSuspiciousUrl(urlString)) return true;

  if (!lastClickIntent || Date.now() - lastClickIntent.timestamp > 1000) {
    return false;
  }

  // Bấm nút Play / khung video thì mọi popup mở tab ngoài đều là popunder
  if (lastClickIntent.isPlayerInteraction) {
    return true;
  }

  const baseHref = targetWindow.location?.href;
  const destParsed = tryParseUrl(urlString, baseHref);
  if (!destParsed) return false;

  const currentOrigin = targetWindow.location?.origin;
  const isCrossOriginDest = Boolean(currentOrigin && destParsed.origin !== currentOrigin);

  // Người dùng bấm vào thẻ <a href="..."> (ví dụ trang chi tiết phim), nhưng JS mở URL cross-origin khác hẳn href gốc
  if (lastClickIntent.clickedAnchorHref) {
    const anchorParsed = tryParseUrl(lastClickIntent.clickedAnchorHref, baseHref);
    if (anchorParsed && isCrossOriginDest && anchorParsed.origin !== destParsed.origin) {
      return true;
    }
    return false;
  }

  // Người dùng bấm vào thẻ không phải <a> (div/span/button...) nhưng JS tự ý nhảy sang origin ngoài
  if (isCrossOriginDest) {
    return true;
  }

  return false;
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
    if (target.toLowerCase() === '_blank' && isUnintendedPopupAttempt(href, targetWindow)) {
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

  lastUserClickTime = 0;
  lastClickIntent = null;
  trackUserGesture(targetWindow);
  installSyntheticAnchorTrap(targetWindow, options);

  function patchedOpen(
    this: Window,
    url?: string | URL,
    target?: string,
    features?: string
  ): WindowProxy | null {
    const urlString = url ? String(url) : '';

    if (isUnintendedPopupAttempt(urlString, targetWindow)) {
      options.onBlocked?.(urlString);
      return null;
    }

    return originalOpen.call(this, url, target, features);
  }

  disguise(patchedOpen, originalOpen);
  targetWindow.open = patchedOpen;
}
