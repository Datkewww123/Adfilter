import { isYouTubeContext } from '../cosmetic/cosmeticEngine';
import {
  clearSecurityChallengeCooldown,
  isSecurityInterstitialDocument,
  markSecurityChallengeCooldown,
  readSecurityChallengeCooldown,
  SECURITY_CHALLENGE_MSG_TYPE,
} from '../core/securityChallenge';
import {
  readCachedSitePaused,
  SITE_WHITELIST_MSG_TYPE,
} from '../core/siteWhitelist';
import { installAntiPopup } from './antiPopup';
import { installAntiRedirect } from './antiRedirect';
import { installAntiAdblockDefuser } from './antiAdblockDefuser';
import { unlockContextMenu } from './antiContextMenuTrap';
import { installVastInterceptor } from './videoAdInterceptor';
import { installShadowShield } from './scriptlets/shadowShield';
import { installDomAppendShield } from './scriptlets/domShield';
import { runCompiledScriptlets } from './scriptlets/runner';

(function initUniversalDefuser() {
  try {
    // Không can thiệp YouTube (kể cả iframe about:blank thuộc YouTube) vì YouTube đã có defuser.ts riêng
    if (isYouTubeContext(window, document)) {
      return;
    }

    // Tôn trọng nút Tạm dừng (Whitelist) ngay ở 0ms trong MAIN world
    if (readCachedSitePaused()) {
      return;
    }

    // Không can thiệp các trang / khung xác thực bảo mật (Cloudflare, hCaptcha, reCAPTCHA, AWS WAF...)
    if (isSecurityInterstitialDocument(window, document)) {
      markSecurityChallengeCooldown();
      return;
    }

    const restorers: Array<() => void> = [];
    let installed = false;
    let disarmed = false;
    let challengeObserver: MutationObserver | null = null;
    let cfTrapActive = false;

    const cleanupCfTrap = () => {
      if (!cfTrapActive) return;
      cfTrapActive = false;
      try {
        delete (window as unknown as Record<string, unknown>)._cf_chl_opt;
      } catch {}
    };

    const stopChallengeWatchers = () => {
      try {
        challengeObserver?.disconnect();
      } catch {}
      challengeObserver = null;
      cleanupCfTrap();
    };

    const restoreAll = () => {
      stopChallengeWatchers();
      while (restorers.length > 0) {
        try {
          restorers.pop()?.();
        } catch {}
      }
      installed = false;
    };

    const postMsgOrigin = () =>
      window.location?.origin && window.location.origin !== 'null'
        ? window.location.origin
        : '*';

    const disarmForSecurityChallenge = () => {
      if (disarmed) return;
      disarmed = true;
      restoreAll();
      markSecurityChallengeCooldown();
      try {
        window.postMessage({ type: SECURITY_CHALLENGE_MSG_TYPE }, postMsgOrigin());
      } catch {}
    };

    const installAll = () => {
      if (installed || disarmed || readCachedSitePaused()) return;
      installed = true;

      // 0. Chạy Scriptlet Engine (Brave/uBO +js), attachShadow Shield & Zero-Flash DOM Append Shield tại document_start
      restorers.push(installShadowShield(window));
      restorers.push(installDomAppendShield(window));
      runCompiledScriptlets(window);

      // 1. Chống bẫy Anti-Adblock trong MAIN world
      restorers.push(installAntiAdblockDefuser(window));

      // 2. Mở khóa chuột phải & copy tranh truyện
      restorers.push(unlockContextMenu(window));

      // 3. Bẫy XML quảng cáo video VAST/VPAID trên web phim
      restorers.push(installVastInterceptor(window));

      // 4. Chống Popup & Pop-under
      restorers.push(
        installAntiPopup(window, {
          onBlocked: (url) => {
            window.postMessage({ type: 'ADFILTER_POPUP_BLOCKED', url }, '*');
          },
        }),
      );

      // 5. Chống tự động chuyển hướng
      restorers.push(installAntiRedirect(window));
    };

    try {
      window.addEventListener('message', (event: MessageEvent) => {
        if (event.source !== window) return;
        const data = event.data as Record<string, unknown> | null | undefined;
        if (data && typeof data === 'object' && data.type === SITE_WHITELIST_MSG_TYPE && data.paused === true) {
          restoreAll();
        }
      });
    } catch {}

    // Nếu vừa gặp trang chờ xác thực trong vòng 30 giây gần đây (đang reload lại), giữ nguyên trình duyệt sạch tại 0ms
    if (readSecurityChallengeCooldown()) {
      const checkAfterChallenge = () => {
        if (disarmed || readCachedSitePaused()) return;
        if (isSecurityInterstitialDocument(window, document)) {
          markSecurityChallengeCooldown();
          return;
        }
        clearSecurityChallengeCooldown();
        installAll();
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAfterChallenge, { once: true });
      } else {
        checkAfterChallenge();
      }
      return;
    }

    installAll();

    // Lần đầu gặp trang chờ Cloudflare: đặt bẫy nhẹ _cf_chl_opt và MutationObserver ngắn hạn trước DOMContentLoaded
    try {
      if (!('_cf_chl_opt' in window)) {
        cfTrapActive = true;
        Object.defineProperty(window, '_cf_chl_opt', {
          configurable: true,
          enumerable: false,
          get() {
            return undefined;
          },
          set(val: unknown) {
            cfTrapActive = false;
            try {
              Object.defineProperty(window, '_cf_chl_opt', {
                value: val,
                writable: true,
                configurable: true,
                enumerable: true,
              });
            } catch {}
            disarmForSecurityChallenge();
          },
        });
      }
    } catch {}

    const checkAndDisarmIfInterstitial = (): boolean => {
      if (disarmed) return true;
      if (isSecurityInterstitialDocument(window, document)) {
        disarmForSecurityChallenge();
        return true;
      }
      return false;
    };

    if (!checkAndDisarmIfInterstitial() && document.readyState === 'loading') {
      const rootNode = document.documentElement || document;
      if (typeof MutationObserver === 'function' && rootNode) {
        challengeObserver = new MutationObserver(() => {
          checkAndDisarmIfInterstitial();
        });
        try {
          challengeObserver.observe(rootNode, { childList: true, subtree: true });
        } catch {}
      }

      document.addEventListener(
        'DOMContentLoaded',
        () => {
          checkAndDisarmIfInterstitial();
          stopChallengeWatchers();
        },
        { once: true },
      );
    } else {
      stopChallengeWatchers();
    }
  } catch {
    // Im lặng để không làm gián đoạn trang web
  }
})();
