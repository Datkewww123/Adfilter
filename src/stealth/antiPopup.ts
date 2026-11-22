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
const DISPATCH_PATCHED_SYMBOL = Symbol.for('adfilter.dispatchPatched');
const FRAME_INSERT_HOOKED_SYMBOL = Symbol.for('adfilter.frameInsertHooked');

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
export function trackUserGesture(targetWindow: Window = window): () => void {
  try {
    const onPointerInput = (e?: Event) => {
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
    };

    const onKeyDown = (e?: Event) => {
      const key = (e as KeyboardEvent | undefined)?.key;
      if (key === 'Enter' || key === ' ') {
        lastClickIntent = null;
      }
    };

    targetWindow.addEventListener('pointerdown', onPointerInput, { capture: true, passive: true });
    targetWindow.addEventListener('touchstart', onPointerInput, { capture: true, passive: true });
    targetWindow.addEventListener('keydown', onKeyDown, { capture: true, passive: true });

    return () => {
      try {
        targetWindow.removeEventListener('pointerdown', onPointerInput, { capture: true });
        targetWindow.removeEventListener('touchstart', onPointerInput, { capture: true });
        targetWindow.removeEventListener('keydown', onKeyDown, { capture: true });
      } catch {}
    };
  } catch {
    // Bỏ qua lỗi context
  }
  return () => {};
}

export function isUserGestureRecent(thresholdMs: number = 1000): boolean {
  return Date.now() - lastUserClickTime <= thresholdMs;
}

export function isRecentPlayerInteraction(thresholdMs: number = 1000): boolean {
  return Boolean(
    lastClickIntent?.isPlayerInteraction &&
      Date.now() - lastClickIntent.timestamp <= thresholdMs,
  );
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

  // Chặn mở tab trống about:blank / '' / about:blank#... để script popunder tự gán location sau đó
  if (!urlString || urlString.startsWith('about:blank')) {
    return true;
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
  let node: HTMLElement | null = anchor;
  const body = targetWindow.document?.body;
  const docEl = targetWindow.document?.documentElement;

  for (let hop = 0; hop < 4 && node && node !== body && node !== docEl; hop++) {
    const trimmedText = (node.textContent || '').replace(/\u00a0/g, '').trim();
    if (hop > 0 && (trimmedText.length > 15 || node.querySelector?.('input, form, video, button'))) {
      break;
    }

    const style = targetWindow.getComputedStyle?.(node);
    const pos = style?.position || node.style?.position;
    if (pos === 'fixed' || pos === 'absolute') {
      const opacity = parseFloat(style?.opacity || node.style?.opacity || '1');
      if (!isNaN(opacity) && opacity < 0.1) return true;

      const rect = node.getBoundingClientRect?.();
      if (rect) {
        if (
          targetWindow.innerWidth > 0 &&
          targetWindow.innerHeight > 0 &&
          rect.width >= targetWindow.innerWidth * 0.5 &&
          rect.height >= targetWindow.innerHeight * 0.5 &&
          trimmedText.length <= 15
        ) {
          return true;
        }
        if (pos === 'fixed' && rect.width > 0 && rect.width <= 4 && rect.height > 0 && rect.height <= 4 && trimmedText.length === 0) {
          return true;
        }
      }
    }

    node = node.parentElement;
  }

  return false;
}

function installNativeAnchorClickTrap(
  targetWindow: Window,
  options: AntiPopupOptions
): () => void {
  const doc = (targetWindow as unknown as { document?: Document }).document;
  if (!doc || typeof doc.addEventListener !== 'function') return () => {};

  const onClickTrap = (e: Event) => {
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

    const baseHref = targetWindow.location?.href;
    const currentOrigin = targetWindow.location?.origin;
    const destParsed = tryParseUrl(fullHref || rawHref, baseHref);
    const isCrossOriginDest = Boolean(currentOrigin && destParsed && destParsed.origin !== currentOrigin);

    const isSuspicious = isSuspiciousUrl(fullHref) || isSuspiciousUrl(rawHref);
    const isHiddenTargetBlank =
      targetAttr === '_blank' && isHiddenTrapAnchor(anchor, targetWindow);
    const isUntrustedBlank =
      targetAttr === '_blank' && e.isTrusted === false && (isCrossOriginDest || isSuspicious);
    const wasInjectedUnderPointer =
      targetAttr === '_blank' &&
      isCrossOriginDest &&
      Boolean(lastClickIntent) &&
      Date.now() - lastClickIntent!.timestamp <= 1000 &&
      lastClickIntent!.clickedAnchorElement !== anchor;

    if (
      isSuspicious ||
      wasHrefSwapped ||
      isHiddenTargetBlank ||
      isUntrustedBlank ||
      wasInjectedUnderPointer
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (wasHrefSwapped && lastClickIntent?.clickedAnchorHref) {
        anchor.setAttribute('href', lastClickIntent.clickedAnchorHref);
      }
      options.onBlocked?.(fullHref || rawHref);
    }
  };

  doc.addEventListener('click', onClickTrap, { capture: true });
  return () => {
    try {
      doc.removeEventListener('click', onClickTrap, { capture: true });
    } catch {}
  };
}

function installSyntheticAnchorTrap(
  targetWindow: Window,
  options: AntiPopupOptions
): () => void {
  const restorers: Array<() => void> = [];
  const anchorCtor = (targetWindow as unknown as { HTMLAnchorElement?: typeof HTMLAnchorElement })
    .HTMLAnchorElement;
  const anchorProto = anchorCtor?.prototype;
  const originalAnchorClick = anchorProto?.click;
  if (anchorProto && originalAnchorClick) {
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
    restorers.push(() => {
      try {
        if (anchorProto.click === patchedAnchorClick) {
          anchorProto.click = originalAnchorClick;
        }
      } catch {}
    });
  }

  // Bắt luôn chiêu a.dispatchEvent(new MouseEvent('click')) kể cả trên thẻ <a> chưa gắn DOM
  const eventTargetProto = (targetWindow as unknown as { EventTarget?: typeof EventTarget })
    .EventTarget?.prototype;
  const origDispatch = eventTargetProto?.dispatchEvent;
  const store = targetWindow as unknown as Record<symbol, unknown>;
  if (eventTargetProto && origDispatch && !store[DISPATCH_PATCHED_SYMBOL]) {
    const patchedDispatch = function (this: EventTarget, event: Event): boolean {
      const isAnchor =
        (anchorCtor && this instanceof anchorCtor) ||
        (this as unknown as { tagName?: string })?.tagName === 'A';
      if (isAnchor && event?.type === 'click') {
        const a = this as unknown as HTMLAnchorElement;
        const target = a.getAttribute?.('target') || a.target || '';
        const href = a.href || a.getAttribute?.('href') || '';
        if (
          (target.toLowerCase() === '_blank' || isSuspiciousUrl(href)) &&
          isUnintendedPopupAttempt(href, targetWindow)
        ) {
          options.onBlocked?.(href);
          return false;
        }
      }
      return origDispatch.call(this, event);
    };

    disguise(
      patchedDispatch as (...args: unknown[]) => unknown,
      origDispatch as (...args: unknown[]) => unknown
    );
    eventTargetProto.dispatchEvent = patchedDispatch;
    store[DISPATCH_PATCHED_SYMBOL] = true;
    restorers.push(() => {
      try {
        if (eventTargetProto.dispatchEvent === patchedDispatch) {
          eventTargetProto.dispatchEvent = origDispatch;
        }
        delete store[DISPATCH_PATCHED_SYMBOL];
      } catch {}
    });
  }

  return () => {
    while (restorers.length > 0) {
      restorers.pop()?.();
    }
  };
}

function installFormSubmitTrap(
  targetWindow: Window,
  options: AntiPopupOptions
): () => void {
  const restorers: Array<() => void> = [];
  const doc = (targetWindow as unknown as { document?: Document }).document;
  if (doc?.addEventListener) {
    const onSubmitTrap = (e: Event) => {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      const target = (form.getAttribute('target') || form.target || '').toLowerCase();
      const action = form.getAttribute('action') || form.action || '';
      if (target === '_blank' && (isSuspiciousUrl(action) || isUnintendedPopupAttempt(action, targetWindow))) {
        e.preventDefault();
        e.stopImmediatePropagation();
        options.onBlocked?.(action);
      }
    };
    doc.addEventListener('submit', onSubmitTrap, { capture: true });
    restorers.push(() => {
      try {
        doc.removeEventListener('submit', onSubmitTrap, { capture: true });
      } catch {}
    });
  }

  const formProto = (targetWindow as unknown as { HTMLFormElement?: typeof HTMLFormElement })
    .HTMLFormElement?.prototype;
  const origSubmit = formProto?.submit;
  if (!formProto || !origSubmit) {
    return () => {
      while (restorers.length > 0) restorers.pop()?.();
    };
  }

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
  restorers.push(() => {
    try {
      if (formProto.submit === patchedSubmit) {
        formProto.submit = origSubmit;
      }
    } catch {}
  });

  return () => {
    while (restorers.length > 0) {
      restorers.pop()?.();
    }
  };
}

function installIframeContentWindowOpenGuard(
  targetWindow: Window,
  createOpenWrapper: (win: Window, orig: Window['open']) => Window['open']
): () => void {
  const restorers: Array<() => void> = [];
  try {
    const store = targetWindow as unknown as Record<symbol, unknown>;
    if (store[IFRAME_HOOKED_SYMBOL]) return () => {};

    const iframeProto = (
      targetWindow as unknown as { HTMLIFrameElement?: typeof HTMLIFrameElement }
    ).HTMLIFrameElement?.prototype;
    if (!iframeProto) return () => {};

    const desc = Object.getOwnPropertyDescriptor(iframeProto, 'contentWindow');
    if (!desc?.get || desc.configurable === false) return () => {};

    const originalGet = desc.get;
    const hookChildWindow = (childWin: Window | null | undefined) => {
      try {
        if (childWin && typeof childWin.open === 'function') {
          const childStore = childWin as unknown as Record<symbol, unknown>;
          if (!childStore[PATCHED_OPEN_SYMBOL]) {
            const origChildOpen = childWin.open;
            const wrappedChildOpen = createOpenWrapper(childWin, origChildOpen);
            childWin.open = wrappedChildOpen;
            childStore[PATCHED_OPEN_SYMBOL] = true;
            restorers.push(() => {
              try {
                if (childWin.open === wrappedChildOpen) {
                  childWin.open = origChildOpen;
                }
                delete childStore[PATCHED_OPEN_SYMBOL];
              } catch {}
            });
          }
        }
      } catch {
        // Cross-origin iframe bảo mật — bỏ qua an toàn
      }
    };

    Object.defineProperty(iframeProto, 'contentWindow', {
      configurable: true,
      get(this: HTMLIFrameElement) {
        const childWin = originalGet.call(this);
        hookChildWindow(childWin);
        return childWin;
      },
    });
    store[IFRAME_HOOKED_SYMBOL] = true;
    restorers.push(() => {
      try {
        Object.defineProperty(iframeProto, 'contentWindow', desc);
        delete store[IFRAME_HOOKED_SYMBOL];
      } catch {}
    });

    // Bắt luôn chiêu appendChild(iframe) rồi gọi window.frames[i].open(...)
    const nodeProto = (targetWindow as unknown as { Node?: typeof Node }).Node?.prototype;
    if (nodeProto && !store[FRAME_INSERT_HOOKED_SYMBOL]) {
      const hookInsertedNode = (node: unknown) => {
        if (!node || typeof node !== 'object') return;
        const el = node as HTMLElement;
        if (el.tagName === 'IFRAME') {
          hookChildWindow(originalGet.call(el as unknown as HTMLIFrameElement));
          return;
        }
        el.querySelectorAll?.('iframe').forEach((frame) => {
          hookChildWindow(originalGet.call(frame));
        });
      };

      if (nodeProto.appendChild) {
        const origAppendChild = nodeProto.appendChild;
        const patchedAppendChild = function <T extends Node>(this: Node, child: T): T {
          const inserted = origAppendChild.call(this, child) as T;
          hookInsertedNode(inserted);
          return inserted;
        };
        disguise(
          patchedAppendChild as (...args: unknown[]) => unknown,
          origAppendChild as (...args: unknown[]) => unknown
        );
        nodeProto.appendChild = patchedAppendChild;
        restorers.push(() => {
          try {
            if (nodeProto.appendChild === patchedAppendChild) {
              nodeProto.appendChild = origAppendChild;
            }
          } catch {}
        });
      }

      if (nodeProto.insertBefore) {
        const origInsertBefore = nodeProto.insertBefore;
        const patchedInsertBefore = function <T extends Node>(
          this: Node,
          newNode: T,
          refNode: Node | null
        ): T {
          const inserted = origInsertBefore.call(this, newNode, refNode) as T;
          hookInsertedNode(inserted);
          return inserted;
        };
        disguise(
          patchedInsertBefore as (...args: unknown[]) => unknown,
          origInsertBefore as (...args: unknown[]) => unknown
        );
        nodeProto.insertBefore = patchedInsertBefore;
        restorers.push(() => {
          try {
            if (nodeProto.insertBefore === patchedInsertBefore) {
              nodeProto.insertBefore = origInsertBefore;
            }
          } catch {}
        });
      }

      store[FRAME_INSERT_HOOKED_SYMBOL] = true;
      restorers.push(() => {
        try {
          delete store[FRAME_INSERT_HOOKED_SYMBOL];
        } catch {}
      });
    }
  } catch {
    // Môi trường không hỗ trợ override
  }

  return () => {
    while (restorers.length > 0) {
      restorers.pop()?.();
    }
  };
}

export function installAntiPopup(targetWindow: Window = window, options: AntiPopupOptions = {}): () => void {
  const originalOpen = targetWindow.open;
  if (!originalOpen) return () => {};

  const restorers: Array<() => void> = [];
  lastUserClickTime = 0;
  lastClickIntent = null;
  restorers.push(trackUserGesture(targetWindow));
  restorers.push(installNativeAnchorClickTrap(targetWindow, options));
  restorers.push(installSyntheticAnchorTrap(targetWindow, options));
  restorers.push(installFormSubmitTrap(targetWindow, options));

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
  restorers.push(() => {
    try {
      if (targetWindow.open === mainPatchedOpen) {
        targetWindow.open = originalOpen;
      }
      delete (targetWindow as unknown as Record<symbol, unknown>)[PATCHED_OPEN_SYMBOL];
    } catch {}
  });

  // Chặn chiêu `delete window.open` quay về Window.prototype.open
  try {
    const winProto = (targetWindow as unknown as { Window?: { prototype?: Window } }).Window
      ?.prototype;
    if (winProto && typeof winProto.open === 'function' && winProto.open !== mainPatchedOpen) {
      const origWinProtoOpen = winProto.open;
      const protoPatchedOpen = createOpenWrapper(targetWindow, origWinProtoOpen);
      winProto.open = protoPatchedOpen;
      restorers.push(() => {
        try {
          if (winProto.open === protoPatchedOpen) {
            winProto.open = origWinProtoOpen;
          }
        } catch {}
      });
    }
  } catch {
    // Bỏ qua nếu Window.prototype bị đóng băng
  }

  restorers.push(installIframeContentWindowOpenGuard(targetWindow, createOpenWrapper));

  return () => {
    while (restorers.length > 0) {
      restorers.pop()?.();
    }
  };
}
