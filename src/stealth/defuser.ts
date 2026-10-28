/**
 * Defuser — Chạy trong MAIN world, document_start.
 * Đặt bẫy JSON.parse, getter/setter hook lên ytInitialPlayerResponse và ytplayer.config
 * để xóa sạch trường QC trước khi trình phát video YouTube kịp đọc.
 *
 * Nâng cấp: Khóa adPlacements/playerAds/adSlots tại Object.prototype và bẫy ytcfg.set
 * để bắn hạ mọi con đường YouTube dùng để truyền thông tin quảng cáo xuống client.
 */
import './interceptor';

const AD_KEYS = [
  'adPlacements',
  'playerAds',
  'adSlots',
  'adBreakParams',
  'adBreakHeartbeatParams',
];

function purge(obj: unknown): void {
  if (obj == null || typeof obj !== 'object') return;
  const record = obj as Record<string, unknown>;
  for (const key of AD_KEYS) {
    if (key in record) delete record[key];
  }
}

// ─── Bẫy 1: JSON.parse ────────────────────────────────────────────────────────
// Chặn sạch mọi chuỗi JSON chứa quảng cáo ngay khi được parse
const origJSONParse = JSON.parse;
JSON.parse = function (text: string, reviver?: (this: any, key: string, value: any) => any) {
  const result = origJSONParse(text, reviver);
  if (result && typeof result === 'object') {
    purge(result);
    if ((result as Record<string, unknown>).playerResponse && typeof (result as Record<string, unknown>).playerResponse === 'object') {
      purge((result as Record<string, unknown>).playerResponse);
    }
  }
  return result;
};

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
// YouTube dùng ytcfg.set({ PLAYER_VARS: {...} }) để truyền cấu hình player.
// Bẫy setter để loại bỏ adPlacements ngay khi ytcfg được ghi.
(function hookYtcfg(): void {
  const MAX_ATTEMPTS = 50; // thử tối đa 5 giây
  let attempts = 0;

  function tryHook(): void {
    const ytcfg = (window as any).ytcfg;
    if (ytcfg && typeof ytcfg.set === 'function') {
      const origSet = ytcfg.set.bind(ytcfg);
      ytcfg.set = function (...args: unknown[]): unknown {
        if (args.length > 0 && args[0] && typeof args[0] === 'object') {
          const data = args[0] as Record<string, unknown>;
          // Xóa PLAYER_VARS.embedded_player_response nếu chứa adPlacements
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
          // Xóa trực tiếp nếu có ở tầng cao
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
// Kỹ thuật của uBlock Origin: đặt getter trên Object.prototype để mọi object
// trong YouTube đều trả về array rỗng/undefined khi truy cập adPlacements.
// Dùng configurable+writable để không phá vỡ code hợp pháp khác.
const PROTO_KEYS_TO_BLOCK = ['adPlacements', 'playerAds'] as const;

for (const key of PROTO_KEYS_TO_BLOCK) {
  try {
    // Chỉ đặt nếu chưa có trên prototype (tránh conflict)
    if (!(key in Object.prototype)) {
      Object.defineProperty(Object.prototype, key, {
        configurable: true,
        get() {
          // Trả về undefined cho mọi object, bao gồm cả YouTube player config
          return undefined;
        },
        set(val: unknown) {
          // Cho phép ghi vào chính đối tượng đó (không phải prototype)
          Object.defineProperty(this as object, key, {
            configurable: true,
            writable: true,
            enumerable: true,
            value: val,
          });
        },
      });
    }
  } catch {
    // Bỏ qua nếu không thể đặt (môi trường bảo mật nghiêm ngặt)
  }
}

console.log('[AdFilter Stealth] Defuser đã kích hoạt ở MAIN world (bẫy JSON.parse + ytcfg + prototype)');

// ─── Bẫy 7: Xóa triệt tiêu popup "Experiencing interruptions" ───────────────
// MutationObserver trên document sẽ phát hiện & xóa ngay khi YouTube chèn popup.
const POPUP_SELECTORS = [
  'yt-notification-action-renderer',
  'tp-yt-paper-toast',
  'ytd-enforcement-message-view-model',
] as const;

function removeInterruptionPopups(): void {
  for (const sel of POPUP_SELECTORS) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      // Chỉ xóa khi chứa nội dung liên quan đến quảng cáo / interruption
      const text = el.textContent?.toLowerCase() ?? '';
      if (
        text.includes('interruption') ||
        text.includes('ad blocker') ||
        text.includes('ads') ||
        text.includes('allow youtube ads') ||
        text.includes('trình chặn')
      ) {
        el.remove();
      }
    }
  }
}

// Chạy ngay lần đầu khi DOM sẵn sàng, sau đó theo dõi thêm bằng MutationObserver
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
