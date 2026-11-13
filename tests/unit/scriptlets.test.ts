import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setConstantScriptlet,
  abortOnPropertyReadScriptlet,
  abortCurrentInlineScriptScriptlet,
  addEventListenerDefuserScriptlet,
  nowoifScriptlet,
} from '../../src/stealth/scriptlets/coreScriptlets';
import {
  runCompiledScriptlets,
  collectScriptletsForHost,
} from '../../src/stealth/scriptlets/runner';
import {
  clearDynamicBlockedUrlPatterns,
  isSuspiciousUrl,
} from '../../src/stealth/urlBlockRegistry';
import type { ScriptletsIndex } from '../../src/stealth/scriptlets/types';

describe('Universal Scriptlet Engine (MAIN world)', () => {
  beforeEach(() => {
    clearDynamicBlockedUrlPatterns();
  });

  afterEach(() => {
    clearDynamicBlockedUrlPatterns();
  });

  it('set-constant khóa giá trị boolean, object rỗng và từ chối prototype pollution', () => {
    const fakeWin = {} as unknown as Window;

    setConstantScriptlet(fakeWin, 'canRunAds', 'true');
    setConstantScriptlet(fakeWin, '__pcHold', 'true');
    setConstantScriptlet(fakeWin, '__PopConfig', '{}');
    setConstantScriptlet(fakeWin, '__proto__.polluted', 'true');

    expect((fakeWin as unknown as Record<string, unknown>).canRunAds).toBe(true);
    expect((fakeWin as unknown as Record<string, unknown>).__pcHold).toBe(true);
    expect((fakeWin as unknown as Record<string, unknown>).__PopConfig).toEqual({});
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();

    // Thử ghi đè nhưng không đổi giá trị đã khóa
    (fakeWin as unknown as Record<string, unknown>).__pcHold = false;
    expect((fakeWin as unknown as Record<string, unknown>).__pcHold).toBe(true);
  });

  it('abort-on-property-read & abort-current-inline-script ngắt script mồi quảng cáo', () => {
    const fakeWin = {
      document: { currentScript: { textContent: 'var x = blockAdBlock();' } },
    } as unknown as Window;

    abortOnPropertyReadScriptlet(fakeWin, 'adProbe.flag');
    expect(() => (fakeWin as unknown as { adProbe: { flag: unknown } }).adProbe.flag).toThrow();

    abortCurrentInlineScriptScriptlet(fakeWin, 'inlineTrap', 'blockAdBlock');
    expect(() => (fakeWin as unknown as { inlineTrap: unknown }).inlineTrap).toThrow();
  });

  it('addEventListener-defuser chặn listener popunder khớp chữ ký và vẫn cho listener bình thường chạy', () => {
    const registered: Array<{ type: string; fn: unknown }> = [];
    class FakeEventTarget {
      addEventListener(type: string, fn: EventListenerOrEventListenerObject | null) {
        registered.push({ type, fn });
      }
    }

    const fakeWin = { EventTarget: FakeEventTarget } as unknown as Window;
    addEventListenerDefuserScriptlet(fakeWin, 'click', '/readyAt|injectedAt|__pc_/');

    const target = new FakeEventTarget();
    const popunderListener = function () {
      const readyAt = Date.now();
      return readyAt;
    };
    const safeListener = function () {
      return 'open-chapter';
    };

    target.addEventListener('click', popunderListener);
    target.addEventListener('click', safeListener);

    expect(registered).toHaveLength(1);
    expect(registered[0].fn).toBe(safeListener);
  });

  it('nowoif đăng ký động mẫu chặn URL vào urlBlockRegistry', () => {
    expect(isSuspiciousUrl('https://fresh-cloaked-ad.example/go')).toBe(false);
    nowoifScriptlet({} as unknown as Window, 'fresh-cloaked-ad.example');
    expect(isSuspiciousUrl('https://fresh-cloaked-ad.example/go')).toBe(true);
  });

  it('runner khớp subdomain và tuyệt đối bỏ qua YouTube', () => {
    const mockIndex: ScriptletsIndex = {
      version: 1,
      global: [{ name: 'set', args: ['canRunAds', 'true'], raw: '+js(set, canRunAds, true)' }],
      byDomain: {
        'truyenqqko.com': [
          { name: 'set', args: ['__pcHold', 'true'], raw: '+js(set, __pcHold, true)' },
        ],
      },
    };

    expect(collectScriptletsForHost(mockIndex, 'www.youtube.com')).toEqual([]);
    expect(collectScriptletsForHost(mockIndex, 'm.youtube.com')).toEqual([]);
    expect(collectScriptletsForHost(mockIndex, 'm.truyenqqko.com')).toHaveLength(2);

    const fakeWin = {} as unknown as Window;
    expect(runCompiledScriptlets(fakeWin, 'www.youtube.com', mockIndex)).toBe(0);
    expect((fakeWin as unknown as Record<string, unknown>).canRunAds).toBeUndefined();

    const executed = runCompiledScriptlets(fakeWin, 'truyenqqko.com', mockIndex);
    expect(executed).toBe(2);
    expect((fakeWin as unknown as Record<string, unknown>).__pcHold).toBe(true);
  });
});
