export const SECURITY_CHALLENGE_SESSION_KEY = 'adfilter_sec_challenge_until';
export const SECURITY_CHALLENGE_MSG_TYPE = 'ADFILTER_SECURITY_CHALLENGE_DETECTED';
export const SECURITY_CHALLENGE_COOLDOWN_MS = 30_000;

export const SECURITY_CHALLENGE_DOMAINS = [
  'challenges.cloudflare.com',
  'turnstile.cloudflare.com',
  'hcaptcha.com',
  'recaptcha.net',
  'arkoselabs.com',
  'funcaptcha.com',
  'captcha-delivery.com',
  'datadome.co',
  'geetest.com',
  'ddos-guard.net',
  'awswaf.com',
  'perimeterx.net',
  'px-cdn.net',
  'impervadns.net',
  'incapdns.net',
] as const;

export const TRUSTED_APP_AND_AUTH_DOMAINS = [
  'chatgpt.com',
  'openai.com',
  'claude.ai',
  'anthropic.com',
  'accounts.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
  'github.com',
  'auth0.com',
  'okta.com',
] as const;

export const SECURITY_WIDGET_MARKER_REGEX =
  /(?:turnstile|cf-chl|cf-turnstile|challenge-running|challenge-stage|challenge-form|cf-wrapper|captcha|recaptcha|hcaptcha|arkose|funcaptcha|datadome|geetest|awswaf|ddos-guard|px-captcha)/i;

const INTERSTITIAL_DOM_SELECTOR = [
  '#challenge-running',
  '#cf-challenge-running',
  '#cf-wrapper',
  '#challenge-stage',
  '#challenge-form',
  '#turnstile-wrapper',
  '#px-captcha',
  '#aws-waf-captcha',
  '#ddos-guard',
  'script[src*="/cdn-cgi/challenge-platform"]',
  'script[src*="/cdn-cgi/l/chk_"]',
  'script[src*="ddos-guard.net/js/"]',
  'script[src*="/_Incapsula_Resource"]',
  'script[src*="captcha-delivery.com"]',
  'script[src*="awswaf.com"]',
  'meta[http-equiv="refresh" i][content*="/cdn-cgi/" i]',
].join(', ');

const CHALLENGE_TITLE_REGEX =
  /^(?:Just a moment\.\.\.|Attention Required!|Checking your browser|Một chút thôi\.\.\.|Đợi một lát\.\.\.)/i;

const CHALLENGE_TEXT_REGEX =
  /cloudflare|ray id|performing security verification|security service|verify you are human|checking your browser/i;

function extractSafeBaseHref(rawBase?: string): string {
  if (rawBase && !rawBase.startsWith('about:')) {
    return rawBase;
  }
  if (
    typeof window !== 'undefined' &&
    window.location?.href &&
    !window.location.href.startsWith('about:')
  ) {
    return window.location.href;
  }
  return 'https://localhost';
}

export function isTrustedAppOrAuthHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  if (!h) return false;
  for (const domain of TRUSTED_APP_AND_AUTH_DOMAINS) {
    if (h === domain || h.endsWith(`.${domain}`)) {
      return true;
    }
  }
  return false;
}

export function isSecurityChallengeHost(hostname: string, pathname = ''): boolean {
  const h = hostname.trim().toLowerCase();
  if (!h) return false;
  if (isTrustedAppOrAuthHost(h)) {
    return true;
  }
  const p = pathname.toLowerCase();

  for (const domain of SECURITY_CHALLENGE_DOMAINS) {
    if (h === domain || h.endsWith(`.${domain}`)) {
      return true;
    }
  }

  if (
    (h === 'google.com' ||
      h.endsWith('.google.com') ||
      h === 'gstatic.com' ||
      h.endsWith('.gstatic.com')) &&
    p.includes('/recaptcha')
  ) {
    return true;
  }

  return false;
}

export function isSecurityChallengeUrl(rawUrl: string, baseHref?: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl, extractSafeBaseHref(baseHref));
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

    const pathLower = parsed.pathname.toLowerCase();
    if (isSecurityChallengeHost(parsed.hostname, pathLower)) {
      return true;
    }

    if (
      pathLower.startsWith('/cdn-cgi/challenge-platform') ||
      pathLower.startsWith('/cdn-cgi/l/chk_') ||
      pathLower.includes('/_incapsula_resource')
    ) {
      return true;
    }

    for (const key of parsed.searchParams.keys()) {
      if (key.startsWith('__cf_chl_')) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

export function isSecurityChallengeContext(
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
): boolean {
  if (!win) return false;
  try {
    const loc = win.location;
    if (loc) {
      if (loc.href && isSecurityChallengeUrl(loc.href)) {
        return true;
      }
      const origins = loc.ancestorOrigins;
      if (origins && origins.length > 0) {
        for (let i = 0; i < origins.length; i++) {
          if (isSecurityChallengeUrl(origins[i])) {
            return true;
          }
        }
      }
    }

    const referrer = doc?.referrer || win.document?.referrer || '';
    if (referrer && isSecurityChallengeUrl(referrer)) {
      return true;
    }

    if (win.parent && win.parent !== win) {
      try {
        const parentHref = win.parent.location?.href || '';
        if (parentHref && isSecurityChallengeUrl(parentHref)) {
          return true;
        }
      } catch {
        // Cross-origin parent frame — bỏ qua an toàn
      }
    }
  } catch {}
  return false;
}

export function isSecurityInterstitialDocument(
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
): boolean {
  if (isSecurityChallengeContext(win, doc)) {
    return true;
  }

  try {
    const anyWin = win as unknown as Record<string, unknown> | undefined;
    if (anyWin && (anyWin._cf_chl_opt != null || anyWin.__CF$cv$params != null)) {
      return true;
    }
  } catch {}

  const targetDoc = doc || win?.document;
  if (!targetDoc) return false;

  try {
    if (targetDoc.querySelector?.(INTERSTITIAL_DOM_SELECTOR)) {
      return true;
    }

    const title = targetDoc.title || '';
    if (title && CHALLENGE_TITLE_REGEX.test(title.trim())) {
      const bodyText = targetDoc.body?.textContent || '';
      if (CHALLENGE_TEXT_REGEX.test(bodyText)) {
        return true;
      }

      const iframes = targetDoc.querySelectorAll?.('iframe[src]');
      if (iframes) {
        for (const frame of Array.from(iframes)) {
          const src = frame.getAttribute('src') || '';
          if (isSecurityChallengeUrl(src, targetDoc.location?.href)) {
            return true;
          }
        }
      }
    }
  } catch {}

  return false;
}

export function isSecurityWidgetElement(el: Element | null | undefined): boolean {
  if (!el || typeof el !== 'object') return false;

  try {
    const ownerDoc = el.ownerDocument;
    let cur: Element | null = el;
    for (let hop = 0; hop < 4 && cur; hop++) {
      if (cur === ownerDoc?.body || cur === ownerDoc?.documentElement) {
        break;
      }
      if (cur.tagName === 'IFRAME') {
        const src = cur.getAttribute?.('src') || '';
        if (src && isSecurityChallengeUrl(src, ownerDoc?.location?.href)) {
          return true;
        }
      }
      const cls = typeof cur.className === 'string' ? cur.className : '';
      const marker = `${cur.id || ''} ${cls}`;
      if (SECURITY_WIDGET_MARKER_REGEX.test(marker)) {
        return true;
      }
      cur = cur.parentElement;
    }
  } catch {}

  return false;
}

export function readSecurityChallengeCooldown(
  storage?: Pick<Storage, 'getItem'> | null,
  now = Date.now(),
): boolean {
  try {
    const store =
      storage !== undefined
        ? storage
        : typeof window !== 'undefined'
          ? window.sessionStorage
          : null;
    if (!store) return false;
    const raw = store.getItem(SECURITY_CHALLENGE_SESSION_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

export function markSecurityChallengeCooldown(
  storage?: Pick<Storage, 'setItem'> | null,
  ttlMs = SECURITY_CHALLENGE_COOLDOWN_MS,
  now = Date.now(),
): void {
  try {
    const store =
      storage !== undefined
        ? storage
        : typeof window !== 'undefined'
          ? window.sessionStorage
          : null;
    store?.setItem(SECURITY_CHALLENGE_SESSION_KEY, String(now + ttlMs));
  } catch {}
}

export function clearSecurityChallengeCooldown(
  storage?: Pick<Storage, 'removeItem'> | null,
): void {
  try {
    const store =
      storage !== undefined
        ? storage
        : typeof window !== 'undefined'
          ? window.sessionStorage
          : null;
    store?.removeItem(SECURITY_CHALLENGE_SESSION_KEY);
  } catch {}
}
