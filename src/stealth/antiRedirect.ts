import { disguise } from './anti-detect';
import { isSuspiciousUrl, isUnintendedPopupAttempt, isUserGestureRecent } from './antiPopup';

export function installAntiRedirect(win: Window = window): void {
  const originalAssign = win.location.assign;
  const originalReplace = win.location.replace;

  function shouldBlockNavigation(url: string): boolean {
    if (isSuspiciousUrl(url) || !isUserGestureRecent(1000)) return true;
    return isUnintendedPopupAttempt(url, win);
  }

  function safeAssign(this: Location, url: string): void {
    if (shouldBlockNavigation(url)) {
      return;
    }
    originalAssign.call(this, url);
  }

  function safeReplace(this: Location, url: string): void {
    if (shouldBlockNavigation(url)) {
      return;
    }
    originalReplace.call(this, url);
  }

  try {
    disguise(safeAssign, originalAssign);
    disguise(safeReplace, originalReplace);

    win.location.assign = safeAssign;
    win.location.replace = safeReplace;
  } catch {
    // Trình duyệt bảo vệ strict context
  }
}
