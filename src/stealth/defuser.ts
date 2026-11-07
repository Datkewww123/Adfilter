/**
 * Defuser — Chạy trong MAIN world, document_start.
 * Đặt bẫy JSON.parse, getter/setter hook lên ytInitialPlayerResponse và ytplayer.config
 * để xóa sạch trường QC trước khi trình phát video YouTube kịp đọc.
 *
 * Nâng cấp:
 * - Xóa hẳn (delete) toàn bộ trường QC và bkaEnforcementMessageViewModel thay vì gán mảng rỗng [],
 *   giúp YouTube Player bỏ qua hoàn toàn bộ đếm chờ quảng cáo 4-5s (0ms startup).
 * - Không làm bẩn Object.prototype để tránh kích hoạt anti-tamper delay 5s của YouTube.
 * - Nhận diện chính xác Livestream có DVR (ytp-live / getVideoData().isLive) và tự động gọi
 *   player.seekToStreamTime() + seekToLiveEdge() để nhảy thẳng tới khúc đang phát trực tiếp.
 * - Khôi phục tự động (Auto-Resume) tức thì khi YouTube tự pause lúc mới mở video hoặc giữa video.
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

  function purgeRecord(record: Record<string, unknown>): boolean {
    let removed = false;
    for (const key of AD_KEYS) {
      if (key in record) {
        const val = record[key];
        const hadAds = Array.isArray(val) ? val.length > 0 : val != null;
        delete record[key];
        if (hadAds) removed = true;
      }
    }

    // Xóa cấu hình cảnh báo / delay chống adblock trong auxiliaryUi
    if (record.auxiliaryUi && typeof record.auxiliaryUi === 'object') {
      const aux = record.auxiliaryUi as Record<string, unknown>;
      if (aux.messageRenderers && typeof aux.messageRenderers === 'object') {
        const renderers = aux.messageRenderers as Record<string, unknown>;
        if ('bkaEnforcementMessageViewModel' in renderers) {
          delete renderers['bkaEnforcementMessageViewModel'];
          removed = true;
        }
        if ('enforcementMessageViewModel' in renderers) {
          delete renderers['enforcementMessageViewModel'];
          removed = true;
        }
      }
    }

    return removed;
  }

  function purge(obj: unknown): void {
    if (obj == null || typeof obj !== 'object') return;
    const record = obj as Record<string, unknown>;
    let removed = purgeRecord(record);

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
        if (purgeRecord(val as Record<string, unknown>)) {
          removed = true;
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

  function syncLiveEdgeIfNeeded(player: any, video: HTMLVideoElement, forceJump = false): void {
    const isLive = isYouTubeLivePlayer(player) || isLivePlayback(video);
    if (!isLive) return;

    const edge = inspectLiveEdge(video);
    const liveBadge = player?.querySelector?.('.ytp-live-badge') as HTMLButtonElement | null;
    const badgeNotAtLiveEdge =
      !!liveBadge &&
      !liveBadge.disabled &&
      liveBadge.getAttribute('disabled') === null &&
      liveBadge.offsetParent !== null;

    const needsJump =
      forceJump ||
      badgeNotAtLiveEdge ||
      (edge.canSeek && !edge.atLiveEdge) ||
      (edge.canSeek && edge.edge !== null && edge.edge > 15 && video.currentTime < 5);

    if (!needsJump) return;

    // 1. Ưu tiên gọi API chuẩn của YouTube Player để nhảy tới thời điểm đang phát trực tiếp
    if (player && typeof player.seekToStreamTime === 'function') {
      try {
        player.seekToStreamTime();
      } catch {}
    }

    // 2. Đồng thời cập nhật trực tiếp currentTime tới sát mép seekable.end (hỗ trợ DVR có duration hữu hạn)
    seekToLiveEdge(video, true);
  }

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
        const player = (document.querySelector('#movie_player') ||
          document.querySelector('.html5-video-player')) as any;
        const v = document.querySelector<HTMLVideoElement>('video');
        if (v && v.paused && !v.ended && v.readyState >= MIN_READY_STATE) {
          syncLiveEdgeIfNeeded(player, v);
          if (player && typeof player.playVideo === 'function') {
            try {
              player.playVideo();
            } catch {}
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

  // ─── Bẫy 7: Smart Auto-Resume & Live Edge Guard ───────────────────────────────
  let _lastUserPauseGestureAt = 0;
  let _navStartedAt = Date.now();
  let _userScrubbedTimeline = false;
  let _liveEdgeSyncedForCurrentVideo = false;
  const USER_PAUSE_WINDOW_MS = 1000;
  const INITIAL_LOAD_WINDOW_MS = 10_000;

  function markUserAction(): void {
    _lastUserPauseGestureAt = Date.now();
  }

  function resetNavigationState(): void {
    _lastUserPauseGestureAt = 0;
    _navStartedAt = Date.now();
    _userScrubbedTimeline = false;
    _liveEdgeSyncedForCurrentVideo = false;
  }

  if (typeof window !== 'undefined') {
    const onUserPointer = (e: MouseEvent | PointerEvent) => {
      if (!e.isTrusted) return;
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;

      // Nếu người dùng tự kéo thanh timeline -> Tôn trọng vị trí tua của người dùng
      if (target.closest('.ytp-progress-bar, .ytp-scrubber-container')) {
        _userScrubbedTimeline = true;
        markUserAction();
        return;
      }

      // Bấm trực tiếp vào nút Play/Pause
      if (target.closest('.ytp-play-button')) {
        markUserAction();
        return;
      }

      // Bấm vào khung player: chỉ tính là cử chỉ Pause khi video thực sự đang phát ổn định
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
      // Phím mũi tên trái/phải hoặc J/L để tua -> đánh dấu người dùng chủ động tua
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
      window.addEventListener(
        'yt-navigate-finish',
        () => {
          resetNavigationState();
          const v = document.querySelector<HTMLVideoElement>(
            '#movie_player video, .html5-video-player video, video',
          );
          if (v) scheduleStartupEnforcement(v);
        },
        { capture: true, passive: true },
      );
    } catch {}

    function enforcePlayAndLiveEdge(video: HTMLVideoElement): void {
      if (video.ended) return;

      const player = (video.closest('#movie_player, .html5-video-player') ||
        document.querySelector('#movie_player') ||
        document.querySelector('.html5-video-player')) as any;

      // Không can thiệp khi đang trong quảng cáo thật
      if (
        player &&
        (player.classList?.contains('ad-showing') || player.classList?.contains('ad-interrupting'))
      ) {
        return;
      }

      const inInitialWindow = Date.now() - _navStartedAt <= INITIAL_LOAD_WINDOW_MS;
      const isLive = isYouTubeLivePlayer(player) || isLivePlayback(video);

      // 1. Nếu là Livestream và mới mở trang (người dùng chưa tự tua):
      // Đảm bảo nhảy thẳng tới khúc đang phát trực tiếp (Live Edge), tuyệt đối không phát từ 0:00!
      if (isLive && inInitialWindow && !_userScrubbedTimeline) {
        const edge = inspectLiveEdge(video);
        if (
          !_liveEdgeSyncedForCurrentVideo ||
          (edge.canSeek && !edge.atLiveEdge && video.currentTime < 5)
        ) {
          syncLiveEdgeIfNeeded(player, video);
          const afterEdge = inspectLiveEdge(video);
          if (afterEdge.atLiveEdge) {
            _liveEdgeSyncedForCurrentVideo = true;
          }
        }
      }

      // 2. Nếu người dùng vừa chủ động bấm Pause -> Tôn trọng tuyệt đối
      if (Date.now() - _lastUserPauseGestureAt < USER_PAUSE_WINDOW_MS) return;

      // 3. Nếu video đang bị Pause (lúc mới vào trang hoặc bị YouTube tự pause ngầm):
      if (video.paused && video.readyState >= MIN_READY_STATE) {
        if (player && typeof player.playVideo === 'function') {
          try {
            player.playVideo();
          } catch {
            void video.play().catch(() => {});
          }
        }
        if (video.paused) {
          void video.play().catch(() => {});
        }
      }
    }

    function scheduleStartupEnforcement(video: HTMLVideoElement): void {
      const delays = [50, 150, 350, 700, 1200, 2000, 3200];
      for (const delay of delays) {
        window.setTimeout(() => {
          enforcePlayAndLiveEdge(video);
        }, delay);
      }
    }

    function attachAutoResume(video: HTMLVideoElement): void {
      if ((video as any)._hasAutoResumeAttached) return;
      (video as any)._hasAutoResumeAttached = true;

      video.addEventListener('loadstart', () => {
        resetNavigationState();
        scheduleStartupEnforcement(video);
      });

      video.addEventListener('loadedmetadata', () => {
        enforcePlayAndLiveEdge(video);
      });

      video.addEventListener('loadeddata', () => {
        enforcePlayAndLiveEdge(video);
      });

      video.addEventListener('canplay', () => {
        enforcePlayAndLiveEdge(video);
      });

      video.addEventListener('playing', () => {
        // Ngay khi Livestream bắt đầu phát lần đầu tiên, kiểm tra xem có bị phát nhầm từ 0:00 không
        const player = (video.closest('#movie_player, .html5-video-player') ||
          document.querySelector('#movie_player') ||
          document.querySelector('.html5-video-player')) as any;
        const isLive = isYouTubeLivePlayer(player) || isLivePlayback(video);
        if (
          isLive &&
          Date.now() - _navStartedAt <= INITIAL_LOAD_WINDOW_MS &&
          !_userScrubbedTimeline
        ) {
          syncLiveEdgeIfNeeded(player, video);
        }
      });

      video.addEventListener('pause', () => {
        if (Date.now() - _lastUserPauseGestureAt < USER_PAUSE_WINDOW_MS) return;
        if (video.ended) return;

        window.setTimeout(() => {
          enforcePlayAndLiveEdge(video);
        }, 40);
      });

      scheduleStartupEnforcement(video);
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
