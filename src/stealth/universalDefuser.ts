import { installAntiPopup } from './antiPopup';
import { installAntiRedirect } from './antiRedirect';

(function initUniversalDefuser() {
  try {
    const host = window.location.hostname;
    // Không can thiệp YouTube vì YouTube đã có defuser.ts riêng
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      return;
    }

    installAntiPopup(window, {
      onBlocked: (url) => {
        window.postMessage({ type: 'ADFILTER_POPUP_BLOCKED', url }, '*');
      },
    });

    installAntiRedirect(window);
  } catch {
    // Im lặng để không làm gián đoạn trang web
  }
})();
