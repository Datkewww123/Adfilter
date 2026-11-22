import { isGamblingMorphologyMatch } from './gamblingMorphology';

// Mẫu khớp trên hostname thật (tên miền đã phân giải qua new URL), tránh quét nhầm vào path/query.
const SUSPICIOUS_HOST_PATTERNS: RegExp[] = [
  /(?:debet|kubet|big88|five88|red88|win79|sunwin|gemwin|rikvip|zowin|nhatvip|go88|hitclub|789club|vsbet|bom88|hdbet|sun88|yo88|zo88|8xbet|shbet|jun88|789bet|new88|fb88|fun88|sin88|sv88|ta88|uk88|lu88|f8bet|mb66|qq88)/i,
  /\b(?:w88|3bet|ok9|casino|nohu|taixiu)\b/i,
  /adqc\.net/i,
  /hit\.club/i,
  /\bbet\d+\b/i,
  /mplmncb/i,
  /clickadu/i,
  /popunder/i,
  /popcash/i,
  /propellerads/i,
  /\bpropeller\b/i,
  /adclick/i,
  /megaredirect/i,
  /bondeddarkenedswerve/i,
  /magiamgia\.space/i,
  /yougetwhatyoupayfor/i,
  // Mạng popunder & ad server quốc tế (ExoClick, JuicyAds, PopAds, MagSrv...)
  /exoclick/i,
  /exosrv/i,
  /realsrv/i,
  /magsrv/i,
  /pemsrv/i,
  /tsyndicate/i,
  /juicyads/i,
  /trafficjunky/i,
  /popads/i,
  /adsterra/i,
  /monetag/i,
  /hilltopads/i,
  /galaksion/i,
  /onclkds/i,
  /onclickads/i,
  /highperformanceformat/i,
  /topcreativeformat/i,
  /betteradsystem/i,
  /acscdn/i,
  /wpadmngr/i,
  /bidgear/i,
  /twinrdengine/i,
  /adsco\.re/i,
  /dtscout/i,
  /wimplyprowlworrisome/i,
  /campfirecroutondecorator/i,
  /bncloudfl/i,
  /vandalcuculla/i,
  /trafficstars/i,
  /jads\.co/i,
  /plugrush/i,
  /adskeeper/i,
  /ero-?advertising/i,
  /trafficforce/i,
  /admaven/i,
  /adxpansion/i,
];

// Đường dẫn / query đặc thù của chuỗi chuyển hướng popunder thật sự
const SUSPICIOUS_PATH_QUERY_PATTERNS: RegExp[] = [
  /\/sklnk\//i,
  /utm_medium=popunder/i,
  /popunder/i,
];

const dynamicPatterns: RegExp[] = [];

function escapeRegexLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Chuyển đổi mẫu pattern chuỗi hoặc `/regex/` từ scriptlet `nowoif` thành RegExp an toàn.
 */
export function compileDynamicPattern(pattern: string): RegExp | null {
  const trimmed = pattern.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
    const lastSlash = trimmed.lastIndexOf('/');
    const body = trimmed.slice(1, lastSlash);
    const flags = trimmed.slice(lastSlash + 1) || 'i';
    try {
      return new RegExp(body, flags.includes('i') ? flags : `${flags}i`);
    } catch {
      return null;
    }
  }

  return new RegExp(escapeRegexLiteral(trimmed), 'i');
}

/**
 * Đăng ký thêm pattern URL chặn popunder lúc chạy (từ Scriptlet `nowoif`).
 */
export function registerDynamicBlockedUrlPattern(pattern: string): boolean {
  const compiled = compileDynamicPattern(pattern);
  if (!compiled) return false;
  if (!dynamicPatterns.some((existing) => existing.source === compiled.source)) {
    dynamicPatterns.push(compiled);
  }
  return true;
}

export function clearDynamicBlockedUrlPatterns(): void {
  dynamicPatterns.length = 0;
}

function tryParseSuspiciousCandidate(rawUrl: string): URL | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const base =
      typeof window !== 'undefined' &&
      window.location?.href &&
      !window.location.href.startsWith('about:')
        ? window.location.href
        : 'https://localhost';
    const parsed = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed, base);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isSuspiciousUrl(url: string): boolean {
  if (!url || url === 'about:blank') return false;

  if (dynamicPatterns.some((pattern) => pattern.test(url))) {
    return true;
  }

  const parsed = tryParseSuspiciousCandidate(url);
  if (parsed) {
    const host = parsed.hostname.toLowerCase();
    const pathLower = parsed.pathname.toLowerCase();
    const pathAndQuery = `${parsed.pathname}${parsed.search}`;

    if (
      (host === 'bit.ly' || host.endsWith('.bit.ly')) &&
      pathLower.startsWith('/adudr')
    ) {
      return true;
    }

    if (
      (host === 'shopee.vn' || host.endsWith('.shopee.vn')) &&
      pathLower.startsWith('/universal-link')
    ) {
      return true;
    }

    if (host.endsWith('.click') && pathLower.startsWith('/tsk/')) {
      return true;
    }

    if (SUSPICIOUS_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
      return true;
    }

    if (SUSPICIOUS_PATH_QUERY_PATTERNS.some((pattern) => pattern.test(pathAndQuery))) {
      return true;
    }
  } else if (SUSPICIOUS_PATH_QUERY_PATTERNS.some((pattern) => pattern.test(url))) {
    return true;
  }

  // Kiểm tra thêm hình thái domain nhà cái (*bet, *88, *win, *club, *vip) trên hostname
  return isGamblingMorphologyMatch(url, '', '', '', '');
}
