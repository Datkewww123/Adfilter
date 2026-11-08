/**
 * Defuser — Chạy trong MAIN world, document_start.
 * Đặt bẫy JSON.parse, getter/setter hook lên ytInitialPlayerResponse và ytplayer.config
 * để xóa sạch trường QC trước khi trình phát video YouTube kịp đọc.
 *
 * Bảo toàn cấu trúc playerResponse (gán mảng rỗng [] cho adPlacements/playerAds/adSlots,
 * không xóa bkaEnforcementMessageViewModel) để tuyệt đối không kích hoạt lỗi 282054944
 * ("Something went wrong. Please try again later.").
 * Phát/tua video: TUYỆT ĐỐI không gọi video.play()/video.pause() hay gán video.currentTime
 * trực tiếp (làm lệch trạng thái nội bộ của YouTube Player → kẹt nút Play/Pause, live trôi
 * sai vị trí). Mọi lệnh đều đi qua API của player: playVideo(), seekToLiveHead().
 */
import './interceptor';
import { disguise } from './anti-detect';
import { releaseScrollLockIfSafe } from './scrollLock';
import { installPauseGuard, isRecentUserPauseGesture } from './pauseGuard';
import { isYouTubeLivePlayer } from '../core/autoplayGuard';

// Chỉ kích hoạt trên môi trường YouTube thật, không chạy trên fake-youtube của E2E test
const isLocalTest =
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

if (!isLocalTest) {
  // ─── Bẫy 0: Theo dõi cử chỉ Play/Pause thật của người dùng (không can thiệp pause()) ───
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
        const v = document.querySelector<HTMLVideoElement>('#movie_player video, video');
        if (v && v.paused && !v.ended && v.readyState >= 3) {
          playViaPlayer(getPlayer(v), v, 'after-popup');
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

  // ─── Bẫy 7: Auto-Resume thông minh qua API của YouTube Player ───
  let _cycleStartedAt = Date.now();
  let _liveHeadDone = false;
  let _userScrubbed = false;

  function getPlayer(video?: HTMLVideoElement | null): any {
    return (
      (video && typeof video.closest === 'function'
        ? video.closest('#movie_player, .html5-video-player')
        : null) ||
      document.querySelector('#movie_player') ||
      document.querySelector('.html5-video-player')
    );
  }

  function isAdShowing(player: any): boolean {
    return (
      !!player &&
      (player.classList?.contains('ad-showing') || player.classList?.contains('ad-interrupting'))
    );
  }

  /** Log chẩn đoán — mở F12 → Console, lọc "[AdFilter debug]". */
  function dbg(event: string, video?: HTMLVideoElement | null, extra?: Record<string, unknown>): void {
    try {
      const player = getPlayer(video);
      console.log('[AdFilter debug]', event, {
        tMs: Date.now() - _cycleStartedAt,
        playerState:
          player && typeof player.getPlayerState === 'function' ? player.getPlayerState() : null,
        paused: video?.paused,
        readyState: video?.readyState,
        currentTime: video ? Number(video.currentTime.toFixed(1)) : null,
        live: isYouTubeLivePlayer(player),
        ad: isAdShowing(player),
        ...extra,
      });
    } catch {}
  }

  function playViaPlayer(player: any, video: HTMLVideoElement, reason: string): void {
    if (player && typeof player.playVideo === 'function') {
      try {
        player.playVideo();
        dbg('playVideo()', video, { reason });
        return;
      } catch {}
    }
    void video.play().catch(() => undefined);
    dbg('video.play() fallback', video, { reason });
  }

  function resetCycle(reason: string): void {
    _cycleStartedAt = Date.now();
    _liveHeadDone = false;
    _userScrubbed = false;
    dbg('reset: ' + reason);
  }

  /**
   * Livestream: Tự động đưa tới thời điểm đang phát trực tiếp (Live Head).
   * Tuyệt đối tôn trọng cử chỉ tua của người dùng (_userScrubbed).
   */
  function tryLiveHead(video: HTMLVideoElement): void {
    if (_liveHeadDone || _userScrubbed) return;
    const player = getPlayer(video);
    if (!isYouTubeLivePlayer(player) || isAdShowing(player)) return;

    // 1. Thử qua API chính thức seekToLiveHead() của YouTube Player
    if (typeof player.isAtLiveHead === 'function' && typeof player.seekToLiveHead === 'function') {
      try {
        if (player.isAtLiveHead() === false) {
          player.seekToLiveHead();
          _liveHeadDone = true;
          dbg('seekToLiveHead()', video);
          return;
        }
      } catch {}
    }

    // 2. Thử qua seekToStreamTime nếu có
    if (typeof player.seekToStreamTime === 'function') {
      try {
        player.seekToStreamTime();
        _liveHeadDone = true;
        dbg('seekToStreamTime()', video);
        return;
      } catch {}
    }

    // 3. Fallback: Nếu video bị kẹt ở mốc 0:00 của DVR mà mép live đã cách xa > 3s -> tua thẳng tới mép live
    try {
      if (video.seekable && video.seekable.length > 0) {
        const edge = video.seekable.end(video.seekable.length - 1);
        if (Number.isFinite(edge) && edge > 0 && edge - video.currentTime > 3) {
          video.currentTime = Math.max(0, edge - 0.5);
          _liveHeadDone = true;
          dbg('seekToLiveEdge fallback', video, { edge, currentTime: video.currentTime });
        }
      }
    } catch {}
  }

  /** Khi video đã nạp khung hình mà vẫn đứng ở trạng thái dừng (không do người dùng) → phát ngay. */
  function tryStartupAutoplay(video: HTMLVideoElement): void {
    if (video.ended) return;
    const player = getPlayer(video);
    if (isAdShowing(player)) return;
    if (!video.paused) {
      if (isYouTubeLivePlayer(player)) tryLiveHead(video);
      return;
    }
    if (isRecentUserPauseGesture(1200)) return;
    if (video.readyState < 2) return;

    if (isYouTubeLivePlayer(player)) {
      tryLiveHead(video);
    }
    playViaPlayer(player, video, 'startup');
  }

  if (typeof window !== 'undefined') {
    const onScrubPointer = (e: MouseEvent | PointerEvent) => {
      if (!e.isTrusted) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        typeof target.closest === 'function' &&
        target.closest('.ytp-progress-bar, .ytp-scrubber-container')
      ) {
        _userScrubbed = true;
      }
    };
    const onScrubKey = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;
      if (
        ['ArrowLeft', 'ArrowRight', 'KeyJ', 'KeyL', 'Home', 'End'].includes(e.code) ||
        /^Digit\d$/.test(e.code)
      ) {
        _userScrubbed = true;
      }
    };

    try {
      window.addEventListener('pointerdown', onScrubPointer, { capture: true, passive: true });
      window.addEventListener('keydown', onScrubKey, { capture: true, passive: true });
      window.addEventListener('yt-navigate-start', () => resetCycle('yt-navigate-start'), {
        capture: true,
        passive: true,
      });
    } catch {}

    function attachPlaybackGuard(video: HTMLVideoElement): void {
      if ((video as any)._adfPlaybackGuard) return;
      (video as any)._adfPlaybackGuard = true;

      video.addEventListener('loadstart', () => resetCycle('loadstart'));
      video.addEventListener('loadeddata', () => tryStartupAutoplay(video));
      video.addEventListener('canplay', () => {
        dbg('canplay', video);
        if (isYouTubeLivePlayer(getPlayer(video))) tryLiveHead(video);
        tryStartupAutoplay(video);
      });
      video.addEventListener('canplaythrough', () => tryStartupAutoplay(video));
      video.addEventListener('playing', () => {
        dbg('playing', video);
        if (isYouTubeLivePlayer(getPlayer(video))) tryLiveHead(video);
      });

      // Pause ngầm (do YouTube tự dừng lúc load, do buffer, hoặc do ad break):
      // Tự động khôi phục playback nếu KHÔNG CÓ cử chỉ Pause thật của người dùng trong 1.2s qua.
      video.addEventListener('pause', () => {
        const isUserPause = isRecentUserPauseGesture(1200);
        dbg('pause', video, { userGesture: isUserPause });
        if (video.ended) return;
        if (isUserPause) return; // Người dùng chủ động pause -> Tôn trọng tuyệt đối

        const resumeNow = () => {
          const player = getPlayer(video);
          if (!video.paused || video.ended) return;
          if (isAdShowing(player) || isRecentUserPauseGesture(1200)) return;
          playViaPlayer(player, video, 'auto-resume-0ms');
        };
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(resumeNow);
        }
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(resumeNow);
        }
        window.setTimeout(resumeNow, 0);
      });

      // Video đã nạp sẵn từ trước khi gắn listener
      if (video.readyState >= 2) tryStartupAutoplay(video);
    }

    document.querySelectorAll<HTMLVideoElement>('video').forEach(attachPlaybackGuard);
    const videoWatcher = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n instanceof HTMLVideoElement) attachPlaybackGuard(n);
          else if (n instanceof HTMLElement) {
            const v = n.querySelector('video');
            if (v) attachPlaybackGuard(v);
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
