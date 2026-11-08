import { installAntiPopup } from './antiPopup';
import { installAntiRedirect } from './antiRedirect';

(function initUniversalDefuser() {
  try {
    // Không can thiệp YouTube vì YouTube đã có defuser.ts riêng
    if (window.location.hostname.includes('youtube.com')) {
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