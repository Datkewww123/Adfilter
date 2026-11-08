import { installAntiPopup } from './antiPopup';

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
  } catch {
    // Im lặng để không gây ảnh hưởng website
  }
})();