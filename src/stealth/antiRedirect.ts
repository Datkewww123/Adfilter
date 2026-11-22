import { disguise } from './anti-detect';
import { isRecentPlayerInteraction, isSuspiciousUrl } from './antiPopup';

export function isSameOriginUrl(url: string, win: Window = window): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const currentOrigin = win.location?.origin;
    if (!currentOrigin || currentOrigin === 'null') return false;
    const baseHref =
      win.location?.href && !win.location.href.startsWith('about:')
        ? win.location.href
        : currentOrigin;
    const parsed = new URL(url, baseHref);
    return parsed.origin === currentOrigin;
  } catch {
    return false;
  }
}

export function installAntiRedirect(win: Window = window): () => void {
  const originalAssign = win.location.assign;
  const originalReplace = win.location.replace;
  let patchedAssign = false;
  let patchedReplace = false;

  function shouldBlockNavigation(url: string): boolean {
    if (isSuspiciousUrl(url)) return true;
    if (isSameOriginUrl(url, win)) return false;
    return isRecentPlayerInteraction(1000);
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
    patchedAssign = win.location.assign === safeAssign;
    win.location.replace = safeReplace;
    patchedReplace = win.location.replace === safeReplace;
  } catch {
    // Trình duyệt bảo vệ strict context
  }

  return () => {
    try {
      if (patchedAssign) {
        win.location.assign = originalAssign;
      }
      if (patchedReplace) {
        win.location.replace = originalReplace;
      }
    } catch {}
  };
}
