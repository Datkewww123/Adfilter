/**
 * Defuser — Chạy trong MAIN world, document_start.
 * Đặt bẫy JSON.parse, getter/setter hook lên ytInitialPlayerResponse và ytplayer.config
 * để xóa sạch trường QC trước khi trình phát video YouTube kịp đọc.
 *
 * Bảo toàn cấu trúc playerResponse (gán mảng rỗng [] cho adPlacements/playerAds/adSlots,
 * không xóa bkaEnforcementMessageViewModel) để tuyệt đối không kích hoạt lỗi 282054944
 * ("Something went wrong. Please try again later.").
 */
import './interceptor';
import { disguise } from './anti-detect';
import { releaseScrollLockIfSafe } from './scrollLock';
import { installPauseGuard } from './pauseGuard';
import {
  MIN_READY_STATE,
  inspectLiveEdge,
  isLivePlayback,
  isYouTubeLivePlayer,
  seekToLiveEdge,
} from '../core/autoplayGuard';

// Chỉ kích hoạt trên môi trường YouTube thật, không chạy trên fake-youtube của E2E test
const isLocalTest =
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

if (!isLocalTest) {
  // ─── Bẫy 0: Khóa lệnh pause ngầm của YouTube trong lúc nạp video ───────────────
  installPauseGuard(window);

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
        const val = record[key];
        if (key === 'adPlacements' || key === 'playerAds' || key === 'adSlots') {
          const hadAds = Array.isArray(val) ? val.length > 0 : val != null;
          record[key] = [];
          if (hadAds) removed = true;
        } else {
          delete record[key];
          removed = true;
        }
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
            const nestedVal = (val as Record<string, unknown>)[key];
            if (key === 'adPlacements' || key === 'playerAds' || key === 'adSlots') {
              const hadAds = Array.isArray(nestedVal) ? nestedVal.length > 0 : nestedVal != null;
              (val as Record<string, unknown>)[key] = [];
              if (hadAds) removed = true;
            } else {
              delete (val as Record<string, unknown>)[key];
              removed = true;
            }
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
  Object.defineProperty = function <T>(
    obj: T,
    prop: PropertyKey,
    desc: PropertyDescriptor & ThisType<any>,
  ): T {
    if (
      obj === (window as unknown) &&
      (prop === 'ytInitialPlayerResponse' || prop === 'ytInitialData')
    ) {
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
      if (
        (result as Record<string, unknown>).playerResponse &&
        typeof (result as Record<string, unknown>).playerResponse === 'object'
      ) {
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
              if (
                pv['embedded_player_response'] &&
                typeof pv['embedded_player_response'] === 'string'
              ) {
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
        return;
      }
      attempts++;
      if (attempts < MAX_ATTEMPTS) {
        window.setTimeout(tryHook, 100);
      }
    }

    tryHook();
  })();

  // ─── Bẫy 6: Xóa triệt tiêu popup Enforcement, Interruption và Backdrop ───────────
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

  const POPUP_SELECTOR = POPUP_SELECTORS.join(', ');
  const ENFORCEMENT_SELECTOR =
    'ytd-enforcement-message-view-model, tp-yt-paper-dialog.ytd-enforcement-message-view-model, #enforce-dialog';
  const ALWAYS_REMOVE_SELECTOR = 'ytd-third-party-manager, snackbar-container';

  function removeInterruptionPopups(
    root: ParentNode = document,
    includeDescendants = true,
  ): void {
    const candidates = new Set<Element>();
    if (root instanceof Element) {
      let ancestor: Element | null = root;
      while (ancestor) {
        if (ancestor.matches(POPUP_SELECTOR)) candidates.add(ancestor);
        ancestor = ancestor.parentElement;
      }
    }
    if (includeDescendants) {
      for (const el of root.querySelectorAll(POPUP_SELECTOR)) candidates.add(el);
    }

    let removedEnforcement = false;
    for (const el of candidates) {
      if (el.matches(ENFORCEMENT_SELECTOR)) {
        (el.closest('tp-yt-paper-dialog, ytd-popup-modal') ?? el).remove();
        removedEnforcement = true;
      } else if (el.matches(ALWAYS_REMOVE_SELECTOR)) {
        el.remove();
      }
    }

    if (removedEnforcement) releaseScrollLockIfSafe(document);

    for (const el of candidates) {
      if (
        el.matches(ENFORCEMENT_SELECTOR) ||
        el.matches(ALWAYS_REMOVE_SELECTOR) ||
        el.matches('tp-yt-iron-overlay-backdrop, iron-overlay-backdrop') ||
        !el.isConnected
      ) {
        continue;
      }
      const text = el.textContent?.toLowerCase() ?? '';
      if (
        text.includes('interruption') ||
        text.includes('ad blocker') ||
        text.includes('ads') ||
        text.includes('allow youtube ads') ||
        text.includes('trình chặn')
      ) {
        el.remove();
        const player = document.querySelector('#movie_player, .html5-video-player');
        const v = document.querySelector<HTMLVideoElement>('video');
        if (v && v.paused && !v.ended && v.readyState >= MIN_READY_STATE) {
          if (isYouTubeLivePlayer(player) || isLivePlayback(v)) {
            const edge = inspectLiveEdge(v);
            if (edge.canSeek && !edge.atLiveEdge) seekToLiveEdge(v, true);
          }
          void v.play().catch(() => undefined);
        }
      }
    }
  }

  function isPlayerMutation(mutation: MutationRecord): boolean {
    const target =
      mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    return !!target?.closest('#movie_player, .html5-video-player');
  }

  function initStealthMonitors(): void {
    removeInterruptionPopups();

    const target = document.body || document.documentElement;
    if (target) {
      new MutationObserver((mutations) => {
        const changedTargets = new Set<Element>();
        const addedRoots = new Set<Element>();
        for (const mutation of mutations) {
          if (isPlayerMutation(mutation)) {
            continue;
          }
          const target =
            mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
          if (target) changedTargets.add(target);
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) addedRoots.add(node);
            else if (node.parentElement) changedTargets.add(node.parentElement);
          }
        }
        for (const root of changedTargets) removeInterruptionPopups(root, false);
        for (const root of addedRoots) removeInterruptionPopups(root);
      }).observe(target, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true,
      });
    }

    document.addEventListener('yt-navigate-finish', () => {
      window.setTimeout(() => {
        removeInterruptionPopups();
      }, 300);
    });
  }

  // ─── Bẫy 7: Auto-Resume & Live Edge Guard (Chỉ chạy khi video đã sẵn sàng canplay) ───
  let _lastUserPauseGestureAt = 0;
  let _navStartedAt = Date.now();
  let _userScrubbedTimeline = false;
  const USER_PAUSE_WINDOW_MS = 1000;
  const INITIAL_LIVE_WINDOW_MS = 10_000;

  function markUserAction(): void {
    _lastUserPauseGestureAt = Date.now();
  }

  function resetNavigationState(): void {
    _lastUserPauseGestureAt = 0;
    _navStartedAt = Date.now();
    _userScrubbedTimeline = false;
  }

  if (typeof window !== 'undefined') {
    const onUserPointer = (e: MouseEvent | PointerEvent) => {
      if (!e.isTrusted) return;
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;

      if (target.closest('.ytp-progress-bar, .ytp-scrubber-container')) {
        _userScrubbedTimeline = true;
        markUserAction();
        return;
      }

      if (target.closest('.ytp-play-button')) {
        markUserAction();
        return;
      }

      const playerContainer = target.closest('#movie_player, .html5-video-player');
      if (playerContainer || target.tagName === 'VIDEO') {
        const vid =
          target.tagName === 'VIDEO'
            ? (target as HTMLVideoElement)
            : playerContainer?.querySelector<HTMLVideoElement>('video');
        if (vid && !vid.paused && vid.currentTime > 0.2) {
          markUserAction();
        }
      }
    };

    const onUserKey = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;
      if (
        e.code === 'Space' ||
        e.key === ' ' ||
        e.code === 'KeyK' ||
        e.key === 'k' ||
        e.key === 'K'
      ) {
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.getAttribute('contenteditable') === 'true')
        ) {
          return;
        }
        markUserAction();
      }
      if (
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'KeyJ' ||
        e.code === 'KeyL'
      ) {
        _userScrubbedTimeline = true;
      }
    };

    try {
      window.addEventListener('pointerdown', onUserPointer, { capture: true, passive: true });
      window.addEventListener('keydown', onUserKey, { capture: true, passive: true });
      window.addEventListener('yt-navigate-start', resetNavigationState, {
        capture: true,
        passive: true,
      });
      window.addEventListener('yt-navigate-finish', resetNavigationState, {
        capture: true,
        passive: true,
      });
    } catch {}

    function attachAutoResume(video: HTMLVideoElement): void {
      if ((video as any)._hasAutoResumeAttached) return;
      (video as any)._hasAutoResumeAttached = true;

      video.addEventListener('loadstart', () => {
        resetNavigationState();
      });

      // Khi video đã thực sự nạp đủ khung hình để phát (canplay / readyState >= 3):
      video.addEventListener('canplay', () => {
        if (video.ended) return;
        const player = (video.closest('#movie_player, .html5-video-player') ||
          document.querySelector('#movie_player') ||
          document.querySelector('.html5-video-player')) as any;
        if (
          player &&
          (player.classList?.contains('ad-showing') ||
            player.classList?.contains('ad-interrupting'))
        ) {
          return;
        }

        // 1. Nếu là Livestream lúc mới mở và bị kẹt ở đầu DVR (currentTime < 5s):
        // Tua tới sát mép phát trực tiếp (Live Edge)
        const isLive = isYouTubeLivePlayer(player) || isLivePlayback(video);
        if (
          isLive &&
          Date.now() - _navStartedAt <= INITIAL_LIVE_WINDOW_MS &&
          !_userScrubbedTimeline
        ) {
          const edge = inspectLiveEdge(video);
          if (edge.canSeek && !edge.atLiveEdge && video.currentTime < 5) {
            seekToLiveEdge(video, true);
          }
        }

        // 2. Nếu lúc mới nạp xong mà video vẫn bị giữ ở trạng thái Pause (không do người dùng bấm):
        if (
          video.paused &&
          video.currentTime < 3 &&
          Date.now() - _lastUserPauseGestureAt >= USER_PAUSE_WINDOW_MS
        ) {
          void video.play().catch(() => {});
        }
      });

      video.addEventListener('pause', () => {
        // Nếu người dùng vừa chủ động tương tác trong 1s qua -> Tôn trọng tuyệt đối
        if (Date.now() - _lastUserPauseGestureAt < USER_PAUSE_WINDOW_MS) return;
        if (video.ended) return;

        const player = (video.closest('#movie_player, .html5-video-player') ||
          document.querySelector('#movie_player') ||
          document.querySelector('.html5-video-player')) as any;
        if (
          player &&
          (player.classList?.contains('ad-showing') ||
            player.classList?.contains('ad-interrupting'))
        ) {
          return;
        }

        // Chỉ khôi phục khi media đã có dữ liệu sẵn sàng (readyState >= 3) để không làm lỗi player
        window.setTimeout(() => {
          if (Date.now() - _lastUserPauseGestureAt < USER_PAUSE_WINDOW_MS) return;
          if (!video.paused || video.ended || video.readyState < 3) return;

          if (player && typeof player.playVideo === 'function') {
            try {
              player.playVideo();
            } catch {
              void video.play().catch(() => {});
            }
          } else {
            void video.play().catch(() => {});
          }
        }, 50);
      });
    }

    // Gắn cho các video hiện có và video mới
    document.querySelectorAll<HTMLVideoElement>('video').forEach(attachAutoResume);
    const videoWatcher = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n instanceof HTMLVideoElement) attachAutoResume(n);
          else if (n instanceof HTMLElement) {
            const v = n.querySelector('video');
            if (v) attachAutoResume(v);
          }
        }
      }
    });
    const docTarget = document.body || document.documentElement;
    if (docTarget) {
      videoWatcher.observe(docTarget, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStealthMonitors);
  } else {
    initStealthMonitors();
  }
}
