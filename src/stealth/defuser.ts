/**
 * Defuser — Chạy trong MAIN world, document_start.
 * Đặt bẫy JSON.parse, getter/setter hook lên ytInitialPlayerResponse và ytplayer.config
 * để xóa sạch trường QC trước khi trình phát video YouTube kịp đọc.
 *
 * Nâng cấp: Khóa adPlacements/playerAds/adSlots tại Object.prototype, bẫy ytcfg.set,
 * ngụy trang native code và tự động triệt tiêu hộp thoại cảnh báo Enforcement.
 */
import './interceptor';
import { disguise } from './anti-detect';

const AD_KEYS = [
  'adPlacements',
  'playerAds',
  'adSlots',
  'adBreakParams',
  'adBreakHeartbeatParams',
];

export function purge(obj: unknown): void {
  if (obj == null || typeof obj !== 'object') return;
  const record = obj as Record<string, unknown>;
  for (const key of AD_KEYS) {
    if (key in record) delete record[key];
  }
}

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
      delete record['adSlots'];
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
          return undefined;
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

// ─── Bẫy 7: Xóa triệt tiêu popup Enforcement và Interruption ───────────────
const POPUP_SELECTORS = [
  'yt-notification-action-renderer',
  'tp-yt-paper-toast',
  'ytd-enforcement-message-view-model',
  'ytd-third-party-manager',
  'snackbar-container',
  'tp-yt-paper-dialog.ytd-enforcement-message-view-model',
] as const;

function removeInterruptionPopups(): void {
  for (const el of document.querySelectorAll('ytd-third-party-manager, snackbar-container, tp-yt-paper-dialog.ytd-enforcement-message-view-model')) {
    el.remove();
  }

  for (const sel of POPUP_SELECTORS) {
    if (sel === 'ytd-third-party-manager' || sel === 'snackbar-container') continue;
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    removeInterruptionPopups();
    new MutationObserver(removeInterruptionPopups).observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
} else {
  removeInterruptionPopups();
  if (document.body) {
    new MutationObserver(removeInterruptionPopups).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}