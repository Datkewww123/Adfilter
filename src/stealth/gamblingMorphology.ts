const SAFE_MORPHOLOGY_WORDS = new Set([
  'alphabet',
  'target',
  'market',
  'ticket',
  'widget',
  'wallet',
  'asset',
  'tablet',
  'cabinet',
  'bucket',
  'packet',
  'rocket',
  'socket',
  'planet',
  'sunset',
  'carpet',
  'snippet',
  'velvet',
  'sherbet',
  'gadget',
  'twin',
  'darwin',
  'edwin',
  'irwin',
  'tailwind',
  'github',
]);

const GAMBLING_LABEL_REGEX =
  /^(?:(?:[a-z]{1,8}|[0-9]{1,4})(?:88|68|79|66|99|789|365)|(?:[0-9]{1,3}|[a-z]{1,6})(?:bet|win|club|vip)|win\d+|bet\d+|ok\d+)$/i;

const EXPLICIT_GAMBLING_TOKEN_REGEX =
  /\b(?:casino|nohu|taixiu|lo\s*de|nha\s*cai|ca\s*cuoc|chinhhang|hdbet|3bet|sun88|vsbet|bom88|yo88|zo88|hitclub|sunwin|gemwin|rikvip|win79|debet|kubet|five88|red88|big88|zowin|nhatvip|fb88|w88|fun88|shbet|jun88|789bet|new88|8xbet|ok9)\b/i;

function extractHostnameSafe(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('/')) return null;
  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isCrossOriginUrl(rawUrl: string, currentHostname: string): boolean {
  const host = extractHostnameSafe(rawUrl);
  if (!host || !currentHostname) return false;
  const cur = currentHostname.toLowerCase();
  return host !== cur && !host.endsWith(`.${cur}`) && !cur.endsWith(`.${host}`);
}

/**
 * Kiểm tra hình thái domain hoặc nhãn/tệp ảnh quảng cáo cá cược/nhà cái Việt Nam
 * mà không cần liệt kê cứng từng tên brand mới (như hdbet, sun88, 3bet, ...).
 */
export function isGamblingMorphologyMatch(
  href: string,
  imgSrc: string = '',
  imgAlt: string = '',
  imgTitle: string = '',
  currentHostname: string = ''
): boolean {
  // 1. Không bao giờ gắn cờ liên kết nội bộ cùng website hiện tại
  const linkHost = extractHostnameSafe(href);
  if (linkHost && currentHostname && !isCrossOriginUrl(href, currentHostname)) {
    return false;
  }

  // 2. Kiểm tra nhãn đầu của domain đích (ví dụ: hdbet.com, 3bet.win, sun88.club)
  if (linkHost) {
    const primaryLabel = linkHost.split('.')[0] || '';
    if (!SAFE_MORPHOLOGY_WORDS.has(primaryLabel) && GAMBLING_LABEL_REGEX.test(primaryLabel)) {
      return true;
    }
  }

  // 3. Kiểm tra tên miền / tên tệp / mô tả ảnh (src, alt, title, href)
  const combinedMeta = `${href} ${imgSrc} ${imgAlt} ${imgTitle}`;
  if (EXPLICIT_GAMBLING_TOKEN_REGEX.test(combinedMeta)) {
    return true;
  }

  const tokens = combinedMeta.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    if (token.length >= 4 && token.length <= 14 && !SAFE_MORPHOLOGY_WORDS.has(token)) {
      if (GAMBLING_LABEL_REGEX.test(token)) {
        return true;
      }
    }
  }

  return false;
}
