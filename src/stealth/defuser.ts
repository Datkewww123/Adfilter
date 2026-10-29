/**
 * Defuser — Chạy trong MAIN world, document_start.
 * Đặt bẫy JSON.parse, getter/setter hook lên ytInitialPlayerResponse và ytplayer.config
 * để xóa sạch trường QC trước khi trình phát video YouTube kịp đọc.
 *
 * Nâng cấp Tuần Stealth-3 & Bản vá Active Ad-Killer:
 * - Khóa bẫy Defuser (Hardening) qua Object.defineProperty.
 * - Hỗ trợ triệt tiêu cả quảng cáo Shorts và Mid-roll.
 * - Xóa triệt để popup cảnh báo và backdrop làm tối màn hình, trả lại quyền điều khiển hoàn toàn cho người dùng.
 * - Toàn bộ can thiệp video (tua, tắt tiếng, nút skip) do Content Script Actuator + instantIntervene() quản lý
 *   với đầy đủ chốt bảo vệ (Circuit Breaker, Baseline Restore).
 * - Loại bỏ hoàn toàn từ khóa 'export' để tương thích 100% với Classic Script của Chrome MV3.
 * - Bỏ qua trên localhost / 127.0.0.1 để môi trường Playwright E2E test độc lập.
 * - Throttle AD_DEFUSED tối đa 1 lần / 2 giây để tránh đếm trùng quảng cáo.
 * - Trả về mảng rỗng [] cho adPlacements/playerAds/adSlots thay vì undefined để triệt tiêu độ trễ 5s của YouTube.
 */
import './interceptor';
import { disguise } from './anti-detect';

// Chỉ kích hoạt trên môi trường YouTube thật, không chạy trên fake-youtube của E2E test
const isLocalTest = typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

if (!isLocalTest) {
  const AD_KEYS = [
    'adPlacements',
    'playerAds',
    'adSlots',
    'adBreakParams',
    'adBreakHeartbeatParams',
    'adBreaks',
  ];

  // Throttle chống spam: chỉ gửi 1 tín hiệu AD_DEFUSED tối đa mỗi 2 giây
  let _lastDefusedAt = 0;
  const DEFUSED_THROTTLE_MS = 2000;

  function purge(obj: unknown): void {
    if (obj == null || typeof obj !== 'object') return;
    const record = obj as Record<string, unknown>;
    let removed = false;

    for (const key of AD_KEYS) {
      if (key in record) {
        if (key === 'adPlacements' || key === 'playerAds' || key === 'adSlots') {
          record[key] = [];
        } else {
          delete record[key];
        }
        removed = true;
      }
    }

    // Triệt tiêu quảng cáo trên YouTube Shorts
    if (Array.isArray(record.entries)) {
      const entries = record.entries as any[];
      const origLen = entries.length;
      const filtered = entries.filter((entry: any) => !entry?.command?.reelWatchEndpoint?.ad);
      if (filtered.length < origLen) {
        record.entries = filtered;
        removed = true;
      }
    }

    // Quét sạch các trường QC lồng nhau 1 cấp (playerResponse, data, v.v.)
    for (const k of Object.keys(record)) {
      const val = record[k];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const key of AD_KEYS) {
          if (key in (val as Record<string, unknown>)) {
            if (key === 'adPlacements' || key === 'playerAds' || key === 'adSlots') {
              (val as Record<string, unknown>)[key] = [];
            } else {
              delete (val as Record<string, unknown>)[key];
            }
            removed = true;
          }
        }
      }
    }

    // Báo cáo về Content Script — throttle 2 giây chống spam đếm trùng
    if (removed && typeof window !== 'undefined') {
      const now = Date.now();
      if (now - _lastDefusedAt >= DEFUSED_THROTTLE_MS) {
        _lastDefusedAt = now;
        try {
          window.postMessage({ source: 'adfilter-defuser', type: 'AD_DEFUSED' }, '*');
        } catch {}
      }
    }
  }

  // ─── Hardening: Khóa bảo vệ bẫy chống bị YouTube ghi đè/gỡ bỏ ───────────────
  const origDefine = Object.defineProperty;
  Object.defineProperty = function <T>(obj: T, prop: PropertyKey, desc: PropertyDescriptor & ThisType<any>): T {
    if (obj === (window as unknown) && (prop === 'ytInitialPlayerResponse' || prop === 'ytInitialData')) {
      if (desc.set) {
        const origSetter = desc.set;
        desc.set = function (val: any) {
          purge(val);
          return origSetter.call(this, val);
        };
      }
    }
    return origDefine(obj, prop, desc);
  };

  // ─── Bẫy 1: JSON.parse có ngụy trang ──────────────────────────────────────────
  const origJSONParse = JSON.parse;
  function patchedJSONParse(text: string, reviver?: (this: any, key: string, value: any) => any) {
    const result = origJSONParse(text, reviver);
    if (result && typeof result === 'object') {
      purge(result);
      if ((result as Record<string, unknown>).playerResponse && typeof (result as Record<string, unknown>).playerResponse === 'object') {
        purge((result as Record<string, unknown>).playerResponse);
      }
    }
    return result;
  }
  JSON.parse = disguise(patchedJSONParse as typeof JSON.parse, origJSONParse);

  // ─── Bẫy 2: ytInitialPlayerResponse ──────────────────────────────────────────
  let _playerResponse: unknown = undefined;

  Object.defineProperty(window, 'ytInitialPlayerResponse', {
    configurable: true,
    get() {
      return _playerResponse;
    },
    set(val: unknown) {
      purge(val);
      _playerResponse = val;
    },
  });

  // ─── Bẫy 3: ytInitialData (trang chủ / gợi ý) ────────────────────────────────
  let _initialData: unknown = undefined;

  Object.defineProperty(window, 'ytInitialData', {
    configurable: true,
    get() {
      return _initialData;
    },
    set(val: unknown) {
      if (val != null && typeof val === 'object') {
        const record = val as Record<string, unknown>;
        record['adSlots'] = [];
        delete record['promotedSparklesWebRenderer'];
      }
      _initialData = val;
    },
  });

  // ─── Bẫy 4: ytplayer.config.args.raw_player_response ────────────────────────
  let _ytplayer: any = (window as any).ytplayer;
  Object.defineProperty(window, 'ytplayer', {
    configurable: true,
    get() {
      return _ytplayer;
    },
    set(val: any) {
      if (val?.config?.args?.raw_player_response) {
        try {
          const raw = origJSONParse(val.config.args.raw_player_response);
          purge(raw);
          val.config.args.raw_player_response = JSON.stringify(raw);
        } catch {}
      }
      _ytplayer = val;
    },
  });

  // ─── Bẫy 5: ytcfg.set ────────────────────────────────────────────────────────
  (function hookYtcfg(): void {
    const MAX_ATTEMPTS = 50;
    let attempts = 0;

    function tryHook(): void {
      const ytcfg = (window as any).ytcfg;
      if (ytcfg && typeof ytcfg.set === 'function') {
        const origSet = ytcfg.set.bind(ytcfg);
        ytcfg.set = function (...args: unknown[]): unknown {
          if (args.length > 0 && args[0] && typeof args[0] === 'object') {
            const data = args[0] as Record<string, unknown>;
            if (data['PLAYER_VARS'] && typeof data['PLAYER_VARS'] === 'object') {
              const pv = data['PLAYER_VARS'] as Record<string, unknown>;
              purge(pv);
              if (pv['embedded_player_response'] && typeof pv['embedded_player_response'] === 'string') {
                try {
                  const parsed = origJSONParse(pv['embedded_player_response']);
                  purge(parsed);
                  pv['embedded_player_response'] = JSON.stringify(parsed);
                } catch {}
              }
            }
            purge(data);
          }
          return origSet(...args);
        };
        console.log('[AdFilter Stealth] ytcfg.set đã bị bẫy thành công');
        return;
      }
      attempts++;
      if (attempts < MAX_ATTEMPTS) {
        window.setTimeout(tryHook, 100);
      }
    }

    tryHook();
  })();

  // ─── Bẫy 6: Object.prototype getters (Nuclear Option) ───────────────────────
  const PROTO_KEYS_TO_BLOCK = ['adPlacements', 'playerAds'] as const;

  for (const key of PROTO_KEYS_TO_BLOCK) {
    try {
      if (!(key in Object.prototype)) {
        Object.defineProperty(Object.prototype, key, {
          configurable: true,
          get() {
            return [];
          },
          set(val: unknown) {
            Object.defineProperty(this as object, key, {
              configurable: true,
              writable: true,
              enumerable: true,
              value: val,
            });
          },
        });
      }
    } catch {}
  }

  console.log('[AdFilter Stealth] Defuser đã kích hoạt ở MAIN world (bẫy JSON.parse + ytcfg + prototype)');

  // ─── Bẫy 7: Xóa triệt tiêu popup Enforcement, Interruption và Backdrop ───────────
  const POPUP_SELECTORS = [
    'yt-notification-action-renderer',
    'tp-yt-paper-toast',
    'ytd-enforcement-message-view-model',
    'ytd-third-party-manager',
    'snackbar-container',
    'tp-yt-paper-dialog.ytd-enforcement-message-view-model',
    '#enforce-dialog',
    'tp-yt-iron-overlay-backdrop',
    'iron-overlay-backdrop',
  ] as const;

  function removeInterruptionPopups(): void {
    // 1. Xóa các phần tử gây cản trở và backdrop làm tối màn hình
    for (const el of document.querySelectorAll('ytd-third-party-manager, snackbar-container, tp-yt-paper-dialog.ytd-enforcement-message-view-model, #enforce-dialog, tp-yt-iron-overlay-backdrop, iron-overlay-backdrop')) {
      el.remove();
    }

    // 2. Mở khóa scroll của body nếu YouTube cố tình khóa
    if (document.body && document.body.style.overflow === 'hidden') {
      document.body.style.overflow = '';
    }

    // 3. Quét các popup cảnh báo có nội dung chống adblock
    for (const sel of POPUP_SELECTORS) {
      if (sel === 'ytd-third-party-manager' || sel === 'snackbar-container' || sel === '#enforce-dialog' || sel === 'tp-yt-iron-overlay-backdrop' || sel === 'iron-overlay-backdrop') continue;
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = el.textContent?.toLowerCase() ?? '';
        if (
          text.includes('interruption') ||
          text.includes('ad blocker') ||
          text.includes('ads') ||
          text.includes('allow youtube ads') ||
          text.includes('trình chặn')
        ) {
          el.remove();
          const v = document.querySelector<HTMLVideoElement>('video');
          if (v && v.paused) {
            void v.play().catch(() => undefined);
          }
        }
      }
    }
  }

  // Khởi tạo MutationObserver và bộ kiểm tra định kỳ cho popup
  function initStealthMonitors(): void {
    removeInterruptionPopups();

    const target = document.body || document.documentElement;
    if (target) {
      new MutationObserver(() => {
        removeInterruptionPopups();
      }).observe(target, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true,
      });
    }

    window.setInterval(() => {
      removeInterruptionPopups();
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStealthMonitors);
  } else {
    initStealthMonitors();
  }
}
