// Danh sách từ khóa/mẫu URL quảng cáo, cờ bạc, popunder & redirector ngụy trang dùng chung
const BASE_SUSPICIOUS_URL_PATTERNS: RegExp[] = [
  /shopee\.vn/i,
  /lazada\.vn/i,
  /bet\d+/i,
  /debet/i,
  /kubet/i,
  /big\d+/i,
  /five\d+/i,
  /red\d+/i,
  /win\d+/i,
  /88/i,
  /casino/i,
  /game.*bai/i,
  /nohu/i,
  /taixiu/i,
  /sunwin/i,
  /gemwin/i,
  /rikvip/i,
  /zowin/i,
  /nhatvip/i,
  /go88/i,
  /hitclub/i,
  /789club/i,
  /b52/i,
  /chinhhang/i,
  /mplmncb/i,
  /clickadu/i,
  /popunder/i,
  /ad.*click/i,
  /pop.*cash/i,
  /propeller/i,
  /traffic/i,
  /redirect/i,
  /bondeddarkenedswerve/i,
  /magiamgia\.space/i,
  /bit\.ly\/adudr/i,
  /yougetwhatyoupayfor/i,
  /\/sklnk\//i,
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

export function isSuspiciousUrl(url: string): boolean {
  if (!url || url === 'about:blank') return false;
  return (
    BASE_SUSPICIOUS_URL_PATTERNS.some((pattern) => pattern.test(url)) ||
    dynamicPatterns.some((pattern) => pattern.test(url))
  );
}
