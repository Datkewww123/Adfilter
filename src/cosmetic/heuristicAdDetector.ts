import {
  isCrossOriginUrl,
  isGamblingMorphologyMatch,
} from '../stealth/gamblingMorphology';
import { isContentListOrLayoutContainer } from './contentSafety';

// Các kích thước chuẩn của banner quảng cáo IAB (dung sai +/- 5px)
export const IAB_SIZES = [
  { w: 300, h: 250 }, // Medium Rectangle (khung chữ nhật phổ biến trong bài đọc truyện)
  { w: 728, h: 90 },  // Leaderboard (banner ngang đầu/cuối trang)
  { w: 160, h: 600 }, // Wide Skyscraper (banner dọc hai bên sườn)
  { w: 320, h: 50 },  // Mobile Leaderboard (banner chân trang mobile)
  { w: 300, h: 600 }, // Half Page (banner chữ nhật lớn)
  { w: 970, h: 250 }, // Billboard (banner siêu lớn đỉnh trang)
];

const EXTERNAL_BANNER_CDN_REGEX = /mplmncb\.com|yougetwhatyoupayfor\.net/i;

/**
 * Kiểm tra xem kích thước phần tử có khớp với kích thước chuẩn IAB hay không (dung sai +/- 5px)
 */
export function isIabBannerSize(width: number, height: number): boolean {
  return IAB_SIZES.some(
    (size) => Math.abs(size.w - width) <= 5 && Math.abs(size.h - height) <= 5
  );
}

function hideAdContainer(container: HTMLElement): void {
  container.style.setProperty('display', 'none', 'important');
  container.style.setProperty('height', '0px', 'important');
  container.style.setProperty('visibility', 'hidden', 'important');
}

function isProtectedContentZone(
  el: HTMLElement,
  doc?: Document,
  allowSingleIframe = false
): boolean {
  return isContentListOrLayoutContainer(el, doc, { allowSingleIframe });
}

/**
 * Quét toàn bộ thẻ iframe kích thước chuẩn IAB và banner quảng cáo ngoài trong thẻ <a>
 * (kết hợp nhận diện hình thái brand + tỷ lệ hình học banner ngang/GIF trỏ cross-origin,
 * bảo vệ an toàn ảnh nội dung bài viết / trang truyện / danh sách chương / poster phim).
 */
export function scanAndHideHeuristicAds(root: Document | HTMLElement = document): number {
  let count = 0;
  const ownerDoc = root.nodeType === 9 ? (root as Document) : root.ownerDocument || undefined;
  const currentHost =
    (root as Document).location?.hostname ||
    root.ownerDocument?.location?.hostname ||
    (typeof window !== 'undefined' ? window.location?.hostname || '' : '');

  const iframes = root.querySelectorAll('iframe');
  iframes.forEach((iframe) => {
    const iframeSrc = iframe.getAttribute('src') || '';
    if (/(?:player|embed|youtube|vimeo|stream)/i.test(iframeSrc)) {
      return;
    }
    const rect = iframe.getBoundingClientRect();
    if (isIabBannerSize(rect.width, rect.height)) {
      const closestDiv = iframe.closest('div') as HTMLElement | null;
      const container =
        closestDiv && !isProtectedContentZone(closestDiv, ownerDoc, true)
          ? closestDiv
          : (iframe as unknown as HTMLElement);
      if (container.style.display !== 'none') {
        hideAdContainer(container);
        count++;
      }
    }
  });

  // Quét banner ảnh quảng cáo bọc trong liên kết (hình thái + tỷ lệ ngang dẹt trỏ cross-origin)
  root.querySelectorAll<HTMLImageElement>('a[href] img').forEach((imgEl) => {
    const anchor = imgEl.closest('a') as HTMLAnchorElement | null;
    if (!anchor) return;
    if (anchor.closest('.movie-item, .film-item, .manga-item, #real-article, header, nav, footer')) {
      return;
    }

    const src = imgEl.getAttribute('src') || '';
    const alt = imgEl.getAttribute('alt') || '';
    const title = imgEl.getAttribute('title') || '';
    const href = anchor.getAttribute('href') || anchor.href || '';

    const isCdnOrMorphology =
      EXTERNAL_BANNER_CDN_REGEX.test(src) ||
      isGamblingMorphologyMatch(href, src, alt, title, currentHost);

    let isCrossOriginStripBanner = false;
    if (!isCdnOrMorphology) {
      const rect = imgEl.getBoundingClientRect?.();
      const isLeaderboardShape = Boolean(
        rect && rect.width >= 260 && rect.height >= 30 && rect.height <= 140 && rect.width / rect.height >= 2.5
      );
      const isExternalAnchor =
        isCrossOriginUrl(href, currentHost) ||
        anchor.getAttribute('target')?.toLowerCase() === '_blank';
      const anchorTextLen = (anchor.textContent || '').trim().length;
      if (isLeaderboardShape && isExternalAnchor && anchorTextLen <= 12) {
        isCrossOriginStripBanner = true;
      }
    }

    if (!isCdnOrMorphology && !isCrossOriginStripBanner) return;

    const candidate = anchor.closest('div, aside, section') as HTMLElement | null;
    const target =
      candidate && !isProtectedContentZone(candidate, ownerDoc, false) ? candidate : anchor;

    if (target.style.display !== 'none') {
      hideAdContainer(target);
      count++;
    }
  });

  return count;
}
