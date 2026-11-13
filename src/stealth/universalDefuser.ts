import { installAntiPopup } from './antiPopup';
import { installAntiRedirect } from './antiRedirect';
import { installAntiAdblockDefuser } from './antiAdblockDefuser';
import { unlockContextMenu } from './antiContextMenuTrap';
import { installVastInterceptor } from './videoAdInterceptor';
import { installShadowShield } from './scriptlets/shadowShield';
import { runCompiledScriptlets } from './scriptlets/runner';

(function initUniversalDefuser() {
  try {
    const host = window.location.hostname;
    const isYouTube =
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      Boolean(typeof window !== 'undefined' && window.location.pathname?.includes('watch.html'));

    // Không can thiệp YouTube vì YouTube đã có defuser.ts riêng
    if (isYouTube) {
      return;
    }

    // 0. Chạy Scriptlet Engine (Brave/uBO +js) & attachShadow Shield ngay tại document_start
    installShadowShield(window);
    runCompiledScriptlets(window);

    // 1. Chống bẫy Anti-Adblock trong MAIN world
    installAntiAdblockDefuser(window);

    // 2. Mở khóa chuột phải & copy tranh truyện
    unlockContextMenu(window);

    // 3. Bẫy XML quảng cáo video VAST/VPAID trên web phim
    installVastInterceptor(window);

    // 4. Chống Popup & Pop-under
    installAntiPopup(window, {
      onBlocked: (url) => {
        window.postMessage({ type: 'ADFILTER_POPUP_BLOCKED', url }, '*');
      },
    });

    // 5. Chống tự động chuyển hướng
    installAntiRedirect(window);
  } catch {
    // Im lặng để không làm gián đoạn trang web
  }
})();
