import { disguise } from './anti-detect';
import { isSuspiciousUrl } from './urlBlockRegistry';

export { isSuspiciousUrl };

export interface AntiPopupOptions {
  onBlocked?: (url: string) => void;
}

interface ClickIntentContext {
  timestamp: number;
  isPlayerInteraction: boolean;
  clickedAnchorElement: Element | null;
  clickedAnchorHref: string | null;
  clickedAnchorTarget: string;
}

const PATCHED_OPEN_SYMBOL = Symbol.for('adfilter.openPatched');
const IFRAME_HOOKED_SYMBOL = Symbol.for('adfilter.iframeHooked');

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
          clickedAnchorElement: anchor,
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
 * Kiểm tra liệu lệnh mở popup/tab/redirect có đi ngược ý định click thật của người dùng hay không.
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

  if (lastClickIntent.isPlayerInteraction) {
    return true;
  }

  const baseHref = targetWindow.location?.href;
  const destParsed = tryParseUrl(urlString, baseHref);
  if (!destParsed) return false;

  const currentOrigin = targetWindow.location?.origin;
  const isCrossOriginDest = Boolean(currentOrigin && destParsed.origin !== currentOrigin);

  if (lastClickIntent.clickedAnchorHref) {
    const anchorParsed = tryParseUrl(lastClickIntent.clickedAnchorHref, baseHref);
    if (anchorParsed && isCrossOriginDest && anchorParsed.origin !== destParsed.origin) {
      return true;
    }
    return false;
  }

  if (isCrossOriginDest) {
    return true;
  }

  return false;
}

function isHiddenTrapAnchor(anchor: HTMLElement, targetWindow: Window): boolean {
  const style = targetWindow.getComputedStyle?.(anchor);
  const pos = style?.position || anchor.style?.position;
  if (pos !== 'fixed' && pos !== 'absolute') return false;

  const opacity = parseFloat(style?.opacity || anchor.style?.opacity || '1');
  if (!isNaN(opacity) && opacity < 0.1) return true;

  const rect = anchor.getBoundingClientRect?.();
  if (
    rect &&
    targetWindow.innerWidth > 0 &&
    targetWindow.innerHeight > 0 &&
    rect.width >= targetWindow.innerWidth * 0.65 &&
    rect.height >= targetWindow.innerHeight * 0.65 &&
    (anchor.textContent || '').trim().length === 0
  ) {
    return true;
  }
  return false;
}

function installNativeAnchorClickTrap(
  targetWindow: Window,
  options: AntiPopupOptions
): void {
  const doc = (targetWindow as unknown as { document?: Document }).document;
  if (!doc || typeof doc.addEventListener !== 'function') return;

  doc.addEventListener(
    'click',
    (e: Event) => {
      const target = (e.target as Element | null) ?? null;
      const anchor = target?.closest?.('a[href]') as HTMLElement | null;
      if (!anchor) return;

      const rawHref = anchor.getAttribute('href') || (anchor as HTMLAnchorElement).href || '';
      const fullHref = (anchor as HTMLAnchorElement).href || rawHref;
      const targetAttr = (anchor.getAttribute('target') || '').toLowerCase();

      const wasHrefSwapped =
        Boolean(lastClickIntent) &&
        lastClickIntent!.clickedAnchorElement === anchor &&
        lastClickIntent!.clickedAnchorHref !== rawHref &&
        lastClickIntent!.clickedAnchorHref !== fullHref;

      const isSuspicious = isSuspiciousUrl(fullHref) || isSuspiciousUrl(rawHref);
      const isHiddenTargetBlank =
        targetAttr === '_blank' && isHiddenTrapAnchor(anchor, targetWindow);

      if (isSuspicious || wasHrefSwapped || isHiddenTargetBlank) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (wasHrefSwapped && lastClickIntent?.clickedAnchorHref) {
          anchor.setAttribute('href', lastClickIntent.clickedAnchorHref);
        }
        options.onBlocked?.(fullHref || rawHref);
      }
    },
    { capture: true }
  );
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
    if (
      (target.toLowerCase() === '_blank' || isSuspiciousUrl(href)) &&
      isUnintendedPopupAttempt(href, targetWindow)
    ) {
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

function installFormSubmitTrap(
  targetWindow: Window,
  options: AntiPopupOptions
): void {
  const doc = (targetWindow as unknown as { document?: Document }).document;
  doc?.addEventListener?.(
    'submit',
    (e: Event) => {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      const target = (form.getAttribute('target') || form.target || '').toLowerCase();
      const action = form.getAttribute('action') || form.action || '';
      if (target === '_blank' && (isSuspiciousUrl(action) || isUnintendedPopupAttempt(action, targetWindow))) {
        e.preventDefault();
        e.stopImmediatePropagation();
        options.onBlocked?.(action);
      }
    },
    { capture: true }
  );

  const formProto = (targetWindow as unknown as { HTMLFormElement?: typeof HTMLFormElement })
    .HTMLFormElement?.prototype;
  const origSubmit = formProto?.submit;
  if (!formProto || !origSubmit) return;

  const patchedSubmit = function (this: HTMLFormElement): void {
    const target = (this.getAttribute('target') || this.target || '').toLowerCase();
    const action = this.getAttribute('action') || this.action || '';
    if (target === '_blank' && (isSuspiciousUrl(action) || isUnintendedPopupAttempt(action, targetWindow))) {
      options.onBlocked?.(action);
      return;
    }
    return origSubmit.call(this);
  };

  disguise(
    patchedSubmit as (...args: unknown[]) => unknown,
    origSubmit as (...args: unknown[]) => unknown
  );
  formProto.submit = patchedSubmit;
}

function installIframeContentWindowOpenGuard(
  targetWindow: Window,
  createOpenWrapper: (win: Window, orig: Window['open']) => Window['open']
): void {
  try {
    const store = targetWindow as unknown as Record<symbol, unknown>;
    if (store[IFRAME_HOOKED_SYMBOL]) return;

    const iframeProto = (
      targetWindow as unknown as { HTMLIFrameElement?: typeof HTMLIFrameElement }
    ).HTMLIFrameElement?.prototype;
    if (!iframeProto) return;

    const desc = Object.getOwnPropertyDescriptor(iframeProto, 'contentWindow');
    if (!desc?.get || desc.configurable === false) return;

    const originalGet = desc.get;
    Object.defineProperty(iframeProto, 'contentWindow', {
      configurable: true,
      get(this: HTMLIFrameElement) {
        const childWin = originalGet.call(this);
        try {
          if (childWin && typeof childWin.open === 'function') {
            const childStore = childWin as unknown as Record<symbol, unknown>;
            if (!childStore[PATCHED_OPEN_SYMBOL]) {
              childWin.open = createOpenWrapper(childWin, childWin.open);
              childStore[PATCHED_OPEN_SYMBOL] = true;
            }
          }
        } catch {
          // Cross-origin iframe bảo mật — bỏ qua an toàn
        }
        return childWin;
      },
    });
    store[IFRAME_HOOKED_SYMBOL] = true;
  } catch {
    // Môi trường không hỗ trợ override
  }
}

export function installAntiPopup(targetWindow: Window = window, options: AntiPopupOptions = {}): void {
  const originalOpen = targetWindow.open;
  if (!originalOpen) return;

  lastUserClickTime = 0;
  lastClickIntent = null;
  trackUserGesture(targetWindow);
  installNativeAnchorClickTrap(targetWindow, options);
  installSyntheticAnchorTrap(targetWindow, options);
  installFormSubmitTrap(targetWindow, options);

  const createOpenWrapper = (ownerWin: Window, origOpen: Window['open']): Window['open'] => {
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

      return origOpen.call(this || ownerWin, url, target, features);
    }

    disguise(patchedOpen, origOpen);
    return patchedOpen;
  };

  const mainPatchedOpen = createOpenWrapper(targetWindow, originalOpen);
  targetWindow.open = mainPatchedOpen;
  (targetWindow as unknown as Record<symbol, unknown>)[PATCHED_OPEN_SYMBOL] = true;

  // Chặn chiêu `delete window.open` quay về Window.prototype.open
  try {
    const winProto = (targetWindow as unknown as { Window?: { prototype?: Window } }).Window
      ?.prototype;
    if (winProto && typeof winProto.open === 'function' && winProto.open !== mainPatchedOpen) {
      winProto.open = createOpenWrapper(targetWindow, winProto.open);
    }
  } catch {
    // Bỏ qua nếu Window.prototype bị đóng băng
  }

  installIframeContentWindowOpenGuard(targetWindow, createOpenWrapper);
}
