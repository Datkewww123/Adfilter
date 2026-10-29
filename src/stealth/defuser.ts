/**
 * Defuser — Chạy trong MAIN world, document_start.
 * Đặt bẫy JSON.parse, getter/setter hook lên ytInitialPlayerResponse và ytplayer.config
 * để xóa sạch trường QC trước khi trình phát video YouTube kịp đọc.
 *
 * Nâng cấp Tuần Stealth-3 & Bản vá Active Ad-Killer:
 * - Khóa bẫy Defuser (Hardening) qua Object.defineProperty.
 * - Hỗ trợ triệt tiêu cả quảng cáo Shorts và Mid-roll.
 * - Active Ad-Killer trong MAIN world: Dập tắt 100% âm thanh quảng cáo ngay lập tức (0ms),
 *   gọi trực tiếp player.skipAd() từ engine gốc và tua dứt điểm không chờ đợi.
 * - Loại bỏ hoàn toàn từ khóa 'export' để tương thích 100% với Classic Script của Chrome MV3.
 */
import './interceptor';
import { disguise } from './anti-detect';

const AD_KEYS = [
  'adPlacements',
  'playerAds',
  'adSlots',
  'adBreakParams',
  'adBreakHeartbeatParams',
  'adBreaks',
  'playbackTracking',
];

function purge(obj: unknown): void {
  if (obj == null || typeof obj !== 'object') return;
  const record = obj as Record<string, unknown>;
  for (const key of AD_KEYS) {
    if (key in record) delete record[key];
  }

  // Triệt tiêu quảng cáo trên YouTube Shorts
  if (Array.isArray(record.entries)) {
    record.entries = record.entries.filter(
      (entry: any) => !entry?.command?.reelWatchEndpoint?.ad,
    );
  }

  // Quét sạch các trường QC lồng nhau 1 cấp (playerResponse, data, v.v.)
  for (const k of Object.keys(record)) {
    const val = record[k];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      for (const key of AD_KEYS) {
        if (key in (val as Record<string, unknown>)) {
          delete (val as Record<string, unknown>)[key];
        }
      }
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
  '#enforce-dialog',
] as const;

function removeInterruptionPopups(): void {
  for (const el of document.querySelectorAll('ytd-third-party-manager, snackbar-container, tp-yt-paper-dialog.ytd-enforcement-message-view-model, #enforce-dialog')) {
    el.remove();
  }

  for (const sel of POPUP_SELECTORS) {
    if (sel === 'ytd-third-party-manager' || sel === 'snackbar-container' || sel === '#enforce-dialog') continue;
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

// ─── Bẫy 8: Active Ad-Killer trong MAIN World (Triệt tiêu 0ms âm thanh & video quảng cáo) ───
let wasAdPlaying = false;

function isCurrentAd(): boolean {
  const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
  if (player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
    return true;
  }
  if (document.querySelector('.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout, .ytp-ad-action-interstitial, .ytp-ad-module:not(:empty)')) {
    return true;
  }
  return false;
}

function killAd(): void {
  if (!isCurrentAd()) {
    if (wasAdPlaying) {
      wasAdPlaying = false;
      const v = document.querySelector<HTMLVideoElement>('video');
      if (v) {
        const player = (document.getElementById('movie_player') || document.querySelector('.html5-video-player')) as any;
        v.muted = player && typeof player.isMuted === 'function' ? player.isMuted() : false;
        v.playbackRate = 1.0;
        if (v.paused) {
          void v.play().catch(() => undefined);
        }
      }
    }
    return;
  }

  wasAdPlaying = true;
  const player = (document.getElementById('movie_player') || document.querySelector('.html5-video-player')) as any;

  // 1. Cưỡng chế TẮT TIẾNG ngay lập tức và tăng tốc 16x toàn bộ thẻ video
  const videos = document.querySelectorAll<HTMLVideoElement>('video');
  for (const v of videos) {
    v.muted = true;
    v.volume = 0;
    v.playbackRate = 16.0;
    if (Number.isFinite(v.duration) && v.duration > 0) {
      v.currentTime = Math.max(0, v.duration - 0.1);
      try {
        v.dispatchEvent(new Event('ended'));
      } catch {}
    } else {
      try {
        v.currentTime = 999999;
      } catch {}
    }
  }

  // 2. Gọi trực tiếp API nội bộ của YouTube player (chỉ có trong MAIN world!)
  try {
    if (player && typeof player.skipAd === 'function') {
      player.skipAd();
    }
  } catch {}

  // 3. Click tất cả các nút Skip của YouTube
  const skipButtons = document.querySelectorAll<HTMLElement>(
    '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-slot, [id^="skip-button"]'
  );
  for (const btn of skipButtons) {
    btn.click();
  }
}

// Lắng nghe sự kiện để dập tắt âm thanh quảng cáo tức thì
document.addEventListener('timeupdate', killAd, true);
document.addEventListener('play', killAd, true);
document.addEventListener(
  'volumechange',
  (e) => {
    if (isCurrentAd()) {
      const target = e.target as HTMLMediaElement;
      if (target && !target.muted) {
        target.muted = true;
        target.volume = 0;
      }
    }
  },
  true,
);

// Khởi tạo MutationObserver và bộ kiểm tra định kỳ 50ms
function initStealthMonitors(): void {
  removeInterruptionPopups();
  killAd();

  const target = document.body || document.documentElement;
  if (target) {
    new MutationObserver(() => {
      removeInterruptionPopups();
      killAd();
    }).observe(target, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });
  }

  window.setInterval(() => {
    removeInterruptionPopups();
    killAd();
  }, 50);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStealthMonitors);
} else {
  initStealthMonitors();
}
