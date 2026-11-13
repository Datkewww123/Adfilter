import { disguise } from '../anti-detect';
import { registerDynamicBlockedUrlPattern } from '../urlBlockRegistry';
import type { EventListenerRule, ScriptletHandler } from './types';

const FORBIDDEN_PROP_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const AELD_RULES_SYMBOL = Symbol.for('adfilter.aeldRules');
const AELD_PATCHED_SYMBOL = Symbol.for('adfilter.aeldPatched');

function resolveConstantValue(rawValue: string): { value: unknown; cloneEachRead: boolean } {
  const trimmed = rawValue.trim();
  if (trimmed === 'true') return { value: true, cloneEachRead: false };
  if (trimmed === 'false') return { value: false, cloneEachRead: false };
  if (trimmed === 'null') return { value: null, cloneEachRead: false };
  if (trimmed === 'undefined') return { value: undefined, cloneEachRead: false };
  if (trimmed === '{}') return { value: {}, cloneEachRead: true };
  if (trimmed === '[]') return { value: [], cloneEachRead: true };
  if (trimmed === 'noopFunc') return { value: () => undefined, cloneEachRead: false };
  if (trimmed === 'trueFunc') return { value: () => true, cloneEachRead: false };
  if (trimmed === 'falseFunc') return { value: () => false, cloneEachRead: false };
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return { value: Number(trimmed), cloneEachRead: false };
  return { value: trimmed, cloneEachRead: false };
}

function getParentContainer(win: Window, propPath: string): { parent: Record<string, unknown>; leaf: string } | null {
  const parts = propPath.split('.').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let cursor: Record<string, unknown> = win as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (FORBIDDEN_PROP_KEYS.has(key)) return null;
    const next = cursor[key];
    if (!next || typeof next !== 'object') {
      const created: Record<string, unknown> = {};
      cursor[key] = created;
      cursor = created;
    } else {
      cursor = next as Record<string, unknown>;
    }
  }

  const leaf = parts[parts.length - 1];
  if (FORBIDDEN_PROP_KEYS.has(leaf)) return null;
  return { parent: cursor, leaf };
}

function buildSafeRegex(pattern: string): RegExp {
  const trimmed = pattern.trim();
  if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
    const last = trimmed.lastIndexOf('/');
    const body = trimmed.slice(1, last);
    const flags = trimmed.slice(last + 1);
    try {
      return new RegExp(body, flags || undefined);
    } catch {
      return new RegExp(body.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
  }
  return new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

/**
 * Scriptlet `set-constant` (`set`): khóa thuộc tính global trả về giá trị hằng an toàn.
 */
export function setConstantScriptlet(win: Window, propPath = '', rawValue = 'undefined'): void {
  if (!propPath) return;
  const target = getParentContainer(win, propPath);
  if (!target) return;

  const { value, cloneEachRead } = resolveConstantValue(rawValue);
  try {
    Object.defineProperty(target.parent, target.leaf, {
      configurable: true,
      get: () => (cloneEachRead ? structuredClone(value) : value),
      set: () => {
        // Giữ nguyên giá trị đã khóa để chống script trang ghi đè
      },
    });
  } catch {
    // Thuộc tính non-configurable trên window, bỏ qua an toàn
  }
}

/**
 * Scriptlet `abort-on-property-read` (`aopr`): ngắt thực thi script khi cố đọc biến mồi.
 */
export function abortOnPropertyReadScriptlet(win: Window, propPath = ''): void {
  if (!propPath) return;
  const target = getParentContainer(win, propPath);
  if (!target) return;

  try {
    Object.defineProperty(target.parent, target.leaf, {
      configurable: true,
      get() {
        throw new ReferenceError(`AdFilter aborted property read: ${propPath}`);
      },
      set() {
        // Không cho ghi đè
      },
    });
  } catch {
    // Bỏ qua nếu không cấu hình được
  }
}

/**
 * Scriptlet `abort-current-inline-script` (`acis`): ngắt script inline chứa từ khóa khi truy cập API/thuộc tính.
 */
export function abortCurrentInlineScriptScriptlet(
  win: Window,
  propPath = '',
  needle = ''
): void {
  if (!propPath) return;
  const target = getParentContainer(win, propPath);
  if (!target) return;

  const currentDescriptor = Object.getOwnPropertyDescriptor(target.parent, target.leaf);
  let storedValue = currentDescriptor?.value;
  const searchRegex = needle ? buildSafeRegex(needle) : null;

  try {
    Object.defineProperty(target.parent, target.leaf, {
      configurable: true,
      get() {
        const inlineCode = win.document?.currentScript?.textContent ?? '';
        if (!searchRegex || searchRegex.test(inlineCode)) {
          throw new ReferenceError(`AdFilter aborted inline script on ${propPath}`);
        }
        return currentDescriptor?.get ? currentDescriptor.get.call(target.parent) : storedValue;
      },
      set(nextVal: unknown) {
        storedValue = nextVal;
      },
    });
  } catch {
    // Bỏ qua an toàn
  }
}

/**
 * Scriptlet `addEventListener-defuser` (`aeld`): vô hiệu hóa listener gắn bẫy click/popunder có chữ ký khớp needle.
 */
export function addEventListenerDefuserScriptlet(
  win: Window,
  eventPattern = '',
  bodyNeedle = ''
): void {
  if (!eventPattern || !bodyNeedle) return;

  const store = win as unknown as Record<symbol, unknown>;
  const rules = (store[AELD_RULES_SYMBOL] as EventListenerRule[] | undefined) ?? [];
  store[AELD_RULES_SYMBOL] = rules;

  const eventRegex = buildSafeRegex(eventPattern);
  const bodyRegex = buildSafeRegex(bodyNeedle);
  if (!rules.some((r) => r.eventRegex.source === eventRegex.source && r.bodyRegex.source === bodyRegex.source)) {
    rules.push({ eventRegex, bodyRegex });
  }

  if (store[AELD_PATCHED_SYMBOL]) return;

  const proto = (win as unknown as { EventTarget?: typeof EventTarget }).EventTarget?.prototype;
  const originalAdd = proto?.addEventListener;
  if (!proto || !originalAdd) return;

  const patchedAdd: typeof EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) {
    if (listener) {
      let source = '';
      try {
        source =
          typeof listener === 'function'
            ? Function.prototype.toString.call(listener)
            : typeof listener.handleEvent === 'function'
              ? Function.prototype.toString.call(listener.handleEvent)
              : '';
      } catch {
        source = '';
      }

      const activeRules = (store[AELD_RULES_SYMBOL] as EventListenerRule[] | undefined) ?? [];
      if (activeRules.some((r) => r.eventRegex.test(type) && r.bodyRegex.test(source))) {
        return;
      }
    }
    return originalAdd.call(this, type, listener, options);
  };

  disguise(patchedAdd as (...args: unknown[]) => unknown, originalAdd as (...args: unknown[]) => unknown);
  proto.addEventListener = patchedAdd;
  store[AELD_PATCHED_SYMBOL] = true;
}

/**
 * Scriptlet `nowoif`: đăng ký mẫu URL chặn mở tab popunder qua window.open và thẻ <a> giả lập.
 */
export function nowoifScriptlet(_win: Window, pattern = ''): void {
  if (!pattern) return;
  for (const part of pattern.split('|').map((s) => s.trim()).filter(Boolean)) {
    registerDynamicBlockedUrlPattern(part);
  }
}

export const SCRIPTLET_REGISTRY: Record<string, ScriptletHandler> = {
  set: setConstantScriptlet,
  'set-constant': setConstantScriptlet,
  aopr: abortOnPropertyReadScriptlet,
  'abort-on-property-read': abortOnPropertyReadScriptlet,
  acis: abortCurrentInlineScriptScriptlet,
  'abort-current-inline-script': abortCurrentInlineScriptScriptlet,
  aeld: addEventListenerDefuserScriptlet,
  'addEventListener-defuser': addEventListenerDefuserScriptlet,
  'prevent-addEventListener': addEventListenerDefuserScriptlet,
  nowoif: nowoifScriptlet,
  'prevent-window-open': nowoifScriptlet,
  'no-window-open-if': nowoifScriptlet,
};
