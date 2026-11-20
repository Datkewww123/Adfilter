import { isSecurityWidgetElement } from '../../core/securityChallenge';
import { disguise } from '../anti-detect';
import { isGamblingMorphologyMatch } from '../gamblingMorphology';
import { isSuspiciousUrl } from '../urlBlockRegistry';

const DOM_SHIELD_INSTALLED = Symbol.for('adfilter.domAppendShieldInstalled');
const SAFE_MODAL_OR_NAV_REGEX =
  /login|signin|sign-in|register|search|chapter|menu|nav|player|video|episode|comment|cookie-settings|captcha|recaptcha|hcaptcha|turnstile|challenge|cloudflare|verify|security|ddos|awswaf|datadome|arkose|geetest|px-captcha/i;
const CLOSE_TEXT_REGEX = /^[×✕✖xX]$|^đóng(?:\s*quảng\s*cáo)?$|^close$/i;

function hideBeforeInsert(el: HTMLElement): void {
  try {
    el.setAttribute('data-adfilter-preblocked', '1');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('height', '0px', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
  } catch {
    // Bỏ qua nếu DOM node bị khóa
  }
}

function hasAdImageOrLink(el: HTMLElement, currentHost: string): boolean {
  const anchors = el.querySelectorAll?.('a[href]');
  if (!anchors || anchors.length === 0) return false;

  for (const a of Array.from(anchors)) {
    const href = a.getAttribute('href') || '';
    const img = a.querySelector('img');
    const src = img?.getAttribute('src') || '';
    const alt = img?.getAttribute('alt') || '';
    const title = img?.getAttribute('title') || '';

    if (
      isSuspiciousUrl(href) ||
      isSuspiciousUrl(src) ||
      isGamblingMorphologyMatch(href, src, alt, title, currentHost)
    ) {
      return true;
    }
  }
  return false;
}

function hasCloseControlOrBackdrop(el: HTMLElement): boolean {
  const styleAttr = (el.getAttribute('style') || '').toLowerCase();
  const isFullscreenDimmed =
    (styleAttr.includes('inset: 0') || styleAttr.includes('inset:0') || styleAttr.includes('rgba(') || styleAttr.includes('blur')) &&
    Boolean(el.querySelector('a[target="_blank"] img, a[href] img[src*=".gif" i]'));

  if (!isFullscreenDimmed) return false;
  if (el.querySelector('[class*="close" i], [aria-label*="close" i]')) return true;

  for (const btn of Array.from(el.querySelectorAll('button, span, a, div'))) {
    const txt = (btn.textContent || '').trim();
    if (txt && txt.length <= 16 && CLOSE_TEXT_REGEX.test(txt)) {
      return true;
    }
  }
  return false;
}

/**
 * Kiểm tra xem node vừa chuẩn bị được gắn vào DOM có phải popup/catfish quảng cáo nổi không
 * để ẩn trước khi trình duyệt kịp vẽ 1 khung hình nào (Zero-Flash 0ms).
 */
export function shouldPreblockInsertedNode(node: unknown, currentHost: string = ''): node is HTMLElement {
  if (!node || typeof node !== 'object' || (node as Node).nodeType !== 1) return false;
  const el = node as HTMLElement;
  if (isSecurityWidgetElement(el)) return false;
  const tag = el.tagName;
  if (tag !== 'DIV' && tag !== 'ASIDE' && tag !== 'SECTION') return false;

  const identifier = `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`;
  if (SAFE_MODAL_OR_NAV_REGEX.test(identifier)) return false;
  if (
    el.querySelector?.(
      'form, input, textarea, select, video, nav, header, footer, ul li + li, ol li + li, table tr + tr'
    )
  ) {
    return false;
  }
  if ((el.querySelectorAll?.('a[href]')?.length ?? 0) > 4) return false;

  if (/\bw-overlay\b|\bcatfish\b|\bpopup-.*ad\b/i.test(identifier)) {
    return true;
  }

  const styleAttr = (el.getAttribute('style') || '').toLowerCase();
  const inlinePos = el.style?.position || '';
  const isFixedOrSticky =
    inlinePos === 'fixed' ||
    inlinePos === 'sticky' ||
    /position\s*:\s*(?:fixed|sticky)/i.test(styleAttr);

  if (!isFixedOrSticky) return false;

  if (/z-index\s*:\s*(?:[2-9]\d{6,}|1\d{7,}|214748\d{4})/i.test(styleAttr)) {
    return true;
  }

  if (hasAdImageOrLink(el, currentHost) || hasCloseControlOrBackdrop(el)) {
    return true;
  }

  return false;
}

/**
 * Cài đặt Pre-Append DOM Shield trong MAIN world:
 * chặn và ẩn popup/catfish ngay tại thời điểm `appendChild` / `insertBefore` / `append` được gọi
 * trước khi browser render (0ms Zero-Flash).
 */
export function installDomAppendShield(win: Window = window): () => void {
  try {
    const store = win as unknown as Record<symbol, unknown>;
    if (store[DOM_SHIELD_INSTALLED]) return () => {};

    const currentHost = win.location?.hostname || '';
    const nodeProto = (win as unknown as { Node?: typeof Node }).Node?.prototype;
    const elProto = (win as unknown as { Element?: typeof Element }).Element?.prototype;
    const restorers: Array<() => void> = [];

    if (nodeProto?.appendChild) {
      const origAppendChild = nodeProto.appendChild;
      const patchedAppendChild = function <T extends Node>(this: Node, child: T): T {
        if (shouldPreblockInsertedNode(child, currentHost)) {
          hideBeforeInsert(child);
        }
        return origAppendChild.call(this, child) as T;
      };
      disguise(
        patchedAppendChild as (...args: unknown[]) => unknown,
        origAppendChild as (...args: unknown[]) => unknown
      );
      nodeProto.appendChild = patchedAppendChild;
      restorers.push(() => {
        if (nodeProto.appendChild === patchedAppendChild) {
          nodeProto.appendChild = origAppendChild;
        }
      });
    }

    if (nodeProto?.insertBefore) {
      const origInsertBefore = nodeProto.insertBefore;
      const patchedInsertBefore = function <T extends Node>(
        this: Node,
        newNode: T,
        refNode: Node | null
      ): T {
        if (shouldPreblockInsertedNode(newNode, currentHost)) {
          hideBeforeInsert(newNode);
        }
        return origInsertBefore.call(this, newNode, refNode) as T;
      };
      disguise(
        patchedInsertBefore as (...args: unknown[]) => unknown,
        origInsertBefore as (...args: unknown[]) => unknown
      );
      nodeProto.insertBefore = patchedInsertBefore;
      restorers.push(() => {
        if (nodeProto.insertBefore === patchedInsertBefore) {
          nodeProto.insertBefore = origInsertBefore;
        }
      });
    }

    if (elProto?.append) {
      const origAppend = elProto.append;
      const patchedAppend = function (this: Element, ...nodes: (Node | string)[]): void {
        for (const n of nodes) {
          if (shouldPreblockInsertedNode(n, currentHost)) {
            hideBeforeInsert(n);
          }
        }
        return origAppend.apply(this, nodes);
      };
      disguise(
        patchedAppend as (...args: unknown[]) => unknown,
        origAppend as (...args: unknown[]) => unknown
      );
      elProto.append = patchedAppend;
      restorers.push(() => {
        if (elProto.append === patchedAppend) {
          elProto.append = origAppend;
        }
      });
    }

    store[DOM_SHIELD_INSTALLED] = true;
    return () => {
      try {
        while (restorers.length > 0) {
          restorers.pop()?.();
        }
        delete store[DOM_SHIELD_INSTALLED];
      } catch {}
    };
  } catch {
    // Im lặng nếu context không cho override DOM prototype
  }
  return () => {};
}
