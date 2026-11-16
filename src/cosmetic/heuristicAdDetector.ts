// Các kích thước chuẩn của banner quảng cáo IAB (dung sai +/- 5px)
export const IAB_SIZES = [
  { w: 300, h: 250 }, // Medium Rectangle (khung chữ nhật phổ biến trong bài đọc truyện)
  { w: 728, h: 90 },  // Leaderboard (banner ngang đầu/cuối trang)
  { w: 160, h: 600 }, // Wide Skyscraper (banner dọc hai bên sườn)
  { w: 320, h: 50 },  // Mobile Leaderboard (banner chân trang mobile)
  { w: 300, h: 600 }, // Half Page (banner chữ nhật lớn)
  { w: 970, h: 250 }, // Billboard (banner siêu lớn đỉnh trang)
];

/**
 * Kiểm tra xem kích thước phần tử có khớp với kích thước chuẩn IAB hay không (dung sai +/- 5px)
 */
export function isIabBannerSize(width: number, height: number): boolean {
  return IAB_SIZES.some(
    (size) => Math.abs(size.w - width) <= 5 && Math.abs(size.h - height) <= 5
  );
}

const EXTERNAL_BANNER_IMAGE_REGEX =
  /mplmncb\.com|yougetwhatyoupayfor\.net|vsbet|bom88|yo88|zo88|hitclub|8xbet|shbet|jun88|789bet|new88|fb88|w88|fun88|sin88|sv88|ta88|uk88|lu88|f8bet|mb66|qq88/i;

function hideAdContainer(container: HTMLElement): void {
  container.style.setProperty('display', 'none', 'important');
  container.style.setProperty('height', '0px', 'important');
  container.style.setProperty('visibility', 'hidden', 'important');
}

/**
 * Quét toàn bộ thẻ iframe kích thước chuẩn IAB và banner quảng cáo ngoài trong thẻ <a>
 * (bảo vệ an toàn ảnh nội dung bài viết / trang truyện / poster phim).
 * @returns Số lượng phần tử quảng cáo đã được ẩn
 */
export function scanAndHideHeuristicAds(root: Document | HTMLElement = document): number {
  let count = 0;
  const iframes = root.querySelectorAll('iframe');

  iframes.forEach((iframe) => {
    const rect = iframe.getBoundingClientRect();
    if (isIabBannerSize(rect.width, rect.height)) {
      const container = (iframe.closest('div') || iframe) as HTMLElement;
      if (container.style.display !== 'none') {
        hideAdContainer(container);
        count++;
      }
    }
  });

  // Quét banner ảnh quảng cáo bọc trong liên kết (kiểm tra cả src, alt, title và tỷ lệ banner leaderboard trong dải QC)
  root.querySelectorAll<HTMLImageElement>('a[href] img').forEach((imgEl) => {
    const src = imgEl.getAttribute('src') || '';
    const alt = imgEl.getAttribute('alt') || '';
    const title = imgEl.getAttribute('title') || '';
    const anchor = imgEl.closest('a');
    const href = anchor?.getAttribute('href') || '';

    const matchedKeyword = EXTERNAL_BANNER_IMAGE_REGEX.test(`${src} ${alt} ${title} ${href}`);
    if (!matchedKeyword) return;

    const container = (anchor?.closest('div, aside, section') || anchor || imgEl) as HTMLElement;
    if (
      container.tagName === 'MAIN' ||
      container.tagName === 'ARTICLE' ||
      Boolean(container.closest('.movie-item, .film-item, .manga-item, #real-article'))
    ) {
      return;
    }
    if (container.style.display !== 'none') {
      hideAdContainer(container);
      count++;
    }
  });

  return count;
}