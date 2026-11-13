import { disguise } from '../anti-detect';
import { isSuspiciousUrl } from '../urlBlockRegistry';

const SHADOW_SHIELD_INSTALLED = Symbol.for('adfilter.shadowShieldInstalled');

const AD_WIDGET_HOST_MARKER_REGEX =
  /\bw-overlay\b|\bw-overlay-(?:catfish|flying|popup)\b|catfish|floating-?ad|ad-?overlay|popup-?ad|qc-overlay/i;

const EXTREME_FIXED_OVERLAY_STYLE_REGEX =
  /position\s*:\s*fixed[\s\S]*?z-index\s*:\s*(?:[2-9]\d{6,}|1\d{7,}|214748\d{4})/i;

function hideAdShadowHost(host: Element): void {
  try {
    host.setAttribute('data-adfilter-shadow-ad', '1');
    const htmlHost = host as HTMLElement;
    if (htmlHost.style) {
      htmlHost.style.setProperty('display', 'none', 'important');
      htmlHost.style.setProperty('visibility', 'hidden', 'important');
      htmlHost.style.setProperty('pointer-events', 'none', 'important');
      htmlHost.style.setProperty('width', '0px', 'important');
      htmlHost.style.setProperty('height', '0px', 'important');
      htmlHost.style.setProperty('opacity', '0', 'important');
    }
  } catch {
    // Bỏ qua nếu phần tử không cho sửa style
  }
}

export function isSuspiciousShadowHost(host: Element, mode: ShadowRootMode): boolean {
  const className = typeof host.className === 'string' ? host.className : '';
  const id = host.id || '';
  const styleAttr = host.getAttribute('style') || '';

  if (AD_WIDGET_HOST_MARKER_REGEX.test(`${className} ${id}`)) {
    return true;
  }

  if (host.hasAttribute('data-zone') && (host.hasAttribute('data-zone-id') || mode === 'closed')) {
    return true;
  }

  if (EXTREME_FIXED_OVERLAY_STYLE_REGEX.test(styleAttr)) {
    return true;
  }

  return false;
}

function containsSuspiciousAdContent(node: Node | string): boolean {
  if (typeof node === 'string') {
    if (isSuspiciousUrl(node)) return true;
    return /assets\.yougetwhatyoupayfor\.net|truyenqq.*popup|chinhhang|w-overlay|sklnk/i.test(node);
  }

  if (node && typeof node === 'object' && 'outerHTML' in node) {
    const el = node as Element;
    const serialized = el.outerHTML || '';
    if (isSuspiciousUrl(serialized)) return true;
    const anchors = el.querySelectorAll?.('a[href]');
    if (anchors) {
      for (const a of Array.from(anchors)) {
        const href = a.getAttribute('href') || '';
        if (isSuspiciousUrl(href)) return true;
      }
    }
  }

  return false;
}

function instrumentShadowRoot(host: Element, root: ShadowRoot, mode: ShadowRootMode): void {
  const shouldWatchContent = mode === 'closed' || !host.tagName.includes('-');
  if (!shouldWatchContent) return;

  try {
    const origAppendChild = root.appendChild.bind(root);
    root.appendChild = function <T extends Node>(child: T): T {
      if (containsSuspiciousAdContent(child)) {
        hideAdShadowHost(host);
        return child;
      }
      return origAppendChild(child);
    };

    const origInsertBefore = root.insertBefore.bind(root);
    root.insertBefore = function <T extends Node>(newNode: T, refNode: Node | null): T {
      if (containsSuspiciousAdContent(newNode)) {
        hideAdShadowHost(host);
        return newNode;
      }
      return origInsertBefore(newNode, refNode);
    };

    const protoDesc = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'innerHTML');
    if (protoDesc?.set && protoDesc.configurable !== false) {
      Object.defineProperty(root, 'innerHTML', {
        configurable: true,
        get() {
          return protoDesc.get ? protoDesc.get.call(root) : '';
        },
        set(html: string) {
          if (containsSuspiciousAdContent(String(html))) {
            hideAdShadowHost(host);
            return;
          }
          protoDesc.set!.call(root, html);
        },
      });
    }
  } catch {
    // Một số môi trường DOM giả lập có thể khóa override trên ShadowRoot
  }
}

/**
 * Cài đặt `attachShadow` Shield trong MAIN world.
 * Phát hiện mọi widget quảng cáo tạo Closed Shadow DOM (bất kể class hash ngẫu nhiên)
 * và đánh dấu/ẩn ngay phần tử host bên ngoài light DOM.
 */
export function installShadowShield(win: Window = window): void {
  try {
    const store = win as unknown as Record<symbol, unknown>;
    if (store[SHADOW_SHIELD_INSTALLED]) return;

    const elProto = (win as unknown as { Element?: typeof Element }).Element?.prototype;
    const originalAttachShadow = elProto?.attachShadow;
    if (!elProto || !originalAttachShadow) return;

    const patchedAttachShadow = function (this: Element, init: ShadowRootInit): ShadowRoot {
      const mode: ShadowRootMode = init?.mode ?? 'open';
      const root = originalAttachShadow.call(this, init);

      if (isSuspiciousShadowHost(this, mode)) {
        hideAdShadowHost(this);
      }

      instrumentShadowRoot(this, root, mode);
      return root;
    };

    disguise(
      patchedAttachShadow as (...args: unknown[]) => unknown,
      originalAttachShadow as (...args: unknown[]) => unknown
    );
    elProto.attachShadow = patchedAttachShadow;
    store[SHADOW_SHIELD_INSTALLED] = true;
  } catch {
    // Im lặng để không làm lỗi trang web bình thường
  }
}
