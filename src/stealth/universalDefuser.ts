import { installAntiPopup } from './antiPopup';
import { installAntiRedirect } from './antiRedirect';
import { installAntiAdblockDefuser } from './antiAdblockDefuser';
import { unlockContextMenu } from './antiContextMenuTrap';

(function initUniversalDefuser() {
  try {
    const host = window.location.hostname;
    // Không can thiệp YouTube vì YouTube đã có defuser.ts riêng
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      return;
    }

    // 1. Chống bẫy Anti-Adblock trong MAIN world
    installAntiAdblockDefuser(window);

    // 2. Mở khóa chuột phải & copy tranh truyện
    unlockContextMenu(window);

    // 3. Chống Popup & Pop-under
    installAntiPopup(window, {
      onBlocked: (url) => {
        window.postMessage({ type: 'ADFILTER_POPUP_BLOCKED', url }, '*');
      },
    });

    // 4. Chống tự động chuyển hướng
    installAntiRedirect(window);
  } catch {
    // Im lặng để không làm gián đoạn trang web
  }
})();
