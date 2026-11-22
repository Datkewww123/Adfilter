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
  /^(?:[a-z]{1,12}(?:88|68|79|66|99|789|365)|(?:[0-9]{1,3}|[a-z]{1,6})(?:bet|win|club|vip)|win\d+|bet\d+|ok\d+)$/i;

const EXPLICIT_GAMBLING_TOKEN_REGEX =
  /\b(?:casino|nohu|taixiu|lo\s*de|nha\s*cai|ca\s*cuoc|hdbet|3bet|sun88|vsbet|bom88|yo88|zo88|hitclub|sunwin|gemwin|rikvip|win79|debet|kubet|five88|red88|big88|zowin|nhatvip|fb88|w88|fun88|shbet|jun88|789bet|new88|8xbet|ok9)\b/i;

function extractHostnameSafe(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('?')) {
    return null;
  }
  if (!/^[a-z][a-z0-9+.-]*:|^\/\//i.test(trimmed)) {
    return null;
  }
  try {
    return new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed).hostname.toLowerCase();
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

function isGamblingHost(host: string): boolean {
  const dotLabels = host.split('.').filter(Boolean);
  for (const dotLabel of dotLabels) {
    const segments = dotLabel.split('-').filter(Boolean);
    for (const seg of segments) {
      if (/^\d+$/.test(seg) || SAFE_MORPHOLOGY_WORDS.has(seg)) continue;
      if (GAMBLING_LABEL_REGEX.test(seg)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Kiểm tra hình thái domain hoặc nhãn/tệp ảnh quảng cáo cá cược/nhà cái Việt Nam
 * mà không cần liệt kê cứng từng tên brand mới (như hdbet, sun88, 3bet, ...).
 * Bảo vệ tuyệt đối liên kết nội bộ / đường dẫn tương đối của truyện, chương, phim.
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

  // 2. Kiểm tra trực tiếp tên miền đích của href hoặc domain ảnh ngoài nếu khớp hình thái nhà cái
  if (linkHost && isGamblingHost(linkHost)) {
    return true;
  }

  const imgHost = extractHostnameSafe(imgSrc);
  const isCrossOriginImg = Boolean(
    imgHost && (!currentHostname || isCrossOriginUrl(imgSrc, currentHostname))
  );
  if (isCrossOriginImg && imgHost && isGamblingHost(imgHost)) {
    return true;
  }

  // 3. Từ khóa nhà cái tường minh chỉ kiểm tra trên hostname đích + metadata ảnh (KHÔNG quét lên path bài viết)
  const hostAndMediaMeta = `${linkHost || ''} ${imgHost || ''} ${imgAlt} ${imgTitle}`;
  if (EXPLICIT_GAMBLING_TOKEN_REGEX.test(hostAndMediaMeta)) {
    return true;
  }

  return false;
}
