const PLAYER_PAUSE_AD_BUTTON_TEXT =
  /^(đóng quảng cáo|đóng và xem tiếp|bỏ qua quảng cáo|tắt quảng cáo|close ad|skip ad)$/i;

const PLAYER_CHROME_PROTECT_REGEX = /tập\s*tiếp|chọn\s*server|bình\s*luận|tắt\s*đèn/i;
const MAIN_PLAYER_FRAME_REGEX = /\b(?:jwplayer|video-js|plyr|art-video-player|media-player)\b/i;

const PLAYER_AD_MEDIA_SELECTOR = [
  'a[href*="bom88"]',
  'a[href*="vsbet"]',
  'a[href*="zo88"]',
  'a[href*="yo88"]',
  'a[href*="hitclub"]',
  'a[href*="hit.club"]',
  'a[href*="sunwin"]',
  'a[href*="gemwin"]',
  'a[href*="rikvip"]',
  'a[href*="win79"]',
  'a[href*="debet"]',
  'a[href*="five88"]',
  'a[href*="red88"]',
  'a[href*="big88"]',
  'a[href*="8xbet"]',
  'a[href*="shbet"]',
  'a[href*="jun88"]',
  'a[href*="789bet"]',
  'a[href*="new88"]',
  'a[href*="fb88"]',
  'a[href*="w88"]',
  'a[href*="fun88"]',
  'img[src*="bom88" i]',
  'img[src*="vsbet" i]',
  'img[src*="yo88" i]',
  'img[src*="zo88" i]',
  'img[src*="hitclub" i]',
  'img[alt*="bom88" i]',
  'img[alt*="vsbet" i]',
  'img[alt*="yo88" i]',
  'img[alt*="zo88" i]',
  'img[alt*="hitclub" i]',
].join(', ');

function hidePlayerOverlay(el: HTMLElement): void {
  el.style.setProperty('display', 'none', 'important');
  el.style.setProperty('height', '0px', 'important');
  el.style.setProperty('visibility', 'hidden', 'important');
  el.style.setProperty('pointer-events', 'none', 'important');
}

function containsProtectedMediaOrChrome(el: HTMLElement): boolean {
  if (el.tagName === 'VIDEO' || el.tagName === 'IFRAME') return true;
  if (el.querySelector('video, iframe, canvas, embed, object')) return true;
  const text = el.textContent || '';
  if (PLAYER_CHROME_PROTECT_REGEX.test(text)) return true;
  return false;
}

function findEnclosingAdOverlay(el: HTMLElement, doc: Document): HTMLElement | null {
  let cursor: HTMLElement = el;
  while (cursor.parentElement) {
    const parent = cursor.parentElement;
    const parentIdentifier = `${parent.id} ${parent.className}`;
    if (
      parent === doc.body ||
      parent === doc.documentElement ||
      parent.tagName === 'MAIN' ||
      parent.tagName === 'ARTICLE' ||
      MAIN_PLAYER_FRAME_REGEX.test(parentIdentifier) ||
      containsProtectedMediaOrChrome(parent)
    ) {
      return cursor === el ? null : cursor;
    }

    const textLen = (parent.textContent || '').trim().length;
    if (textLen > 450) {
      break;
    }
    cursor = parent;
  }
  if (cursor === el) {
    return el.parentElement && !containsProtectedMediaOrChrome(el.parentElement)
      ? el.parentElement
      : null;
  }
  return containsProtectedMediaOrChrome(cursor) ? null : cursor;
}

/**
 * Tự động đóng các banner quảng cáo xuất hiện trên khung phát video (JWPlayer, Video.js, HTML5 player)
 * khi người dùng tạm dừng video (click-to-pause ads) hoặc trong lúc đang xem phim.
 */
export function autoCloseMovieOverlays(doc: Document = document): number {
  const closeSelectors = [
    '.jw-ad-close',
    '.vjs-ad-close',
    '.video-ad-close',
    '.close-banner',
    '.btn-close-ad',
    '.ad-close-btn',
    '.close-ad',
    '[class*="ad-close"]',
    '[id*="ad-close"]',
    '[class*="close-ad"]',
    '[id*="close-ad"]',
    '[aria-label*="Close Ad" i]',
    '[aria-label*="Đóng quảng cáo" i]',
    '[title*="Close Ad" i]',
    '[title*="Đóng quảng cáo" i]',
  ].join(', ');

  const closeButtons = doc.querySelectorAll<HTMLElement>(closeSelectors);
  let count = 0;

  closeButtons.forEach((btn) => {
    try {
      btn.click();
      count++;
    } catch {
      // Bỏ qua nếu click gặp lỗi
    }
  });

  return count;
}

/**
 * Ẩn triệt để các khung chứa quảng cáo đè lên trình phát video (kể cả Pause-Ad custom kiểu AnimeVietsub),
 * luôn bảo toàn tuyệt đối khung video/iframe trình phát và thanh điều khiển tập phim.
 */
export function purgeMoviePlayerAdOverlays(doc: Document = document): number {
  const overlaySelectors = [
    '.jw-ad-ui',
    '.vjs-ad-overlay',
    '.video-ad-overlay',
    '.video-ads',
    '[class*="player-ad" i]',
    '[id*="player-ad" i]',
    '[class*="ad-overlay" i]',
    '[id*="ad-overlay" i]',
    '[class*="pause-ad" i]',
    '[id*="pause-ad" i]',
  ].join(', ');

  let count = 0;

  doc.querySelectorAll<HTMLElement>(overlaySelectors).forEach((el) => {
    if (!containsProtectedMediaOrChrome(el) && el.style.display !== 'none') {
      hidePlayerOverlay(el);
      count++;
    }
  });

  // Nhận diện Pause-Ad / Overlay dựa theo nút đặc trưng ("Đóng quảng cáo", "Đóng và xem tiếp"...)
  doc.querySelectorAll<HTMLElement>('button, a, span, div').forEach((node) => {
    const label = (node.textContent || '').trim();
    if (!label || label.length > 40 || !PLAYER_PAUSE_AD_BUTTON_TEXT.test(label)) {
      return;
    }

    const overlayBox = findEnclosingAdOverlay(node, doc);
    if (
      overlayBox &&
      overlayBox !== doc.body &&
      !containsProtectedMediaOrChrome(overlayBox) &&
      overlayBox.style.display !== 'none'
    ) {
      hidePlayerOverlay(overlayBox);
      count++;
    }
  });

  // Quét overlay chứa banner cá cược nằm đè bên trong hoặc cạnh player video
  doc
    .querySelectorAll<HTMLElement>(
      '.jwplayer, .video-js, .plyr, .art-video-player, [class*="player" i], [id*="player" i]'
    )
    .forEach((player) => {
      player.querySelectorAll<HTMLElement>(PLAYER_AD_MEDIA_SELECTOR).forEach((mediaEl) => {
        const container = findEnclosingAdOverlay(mediaEl, doc) || mediaEl;
        if (
          container !== player &&
          !containsProtectedMediaOrChrome(container) &&
          container.style.display !== 'none'
        ) {
          hidePlayerOverlay(container);
          count++;
        }
      });
    });

  return count;
}
