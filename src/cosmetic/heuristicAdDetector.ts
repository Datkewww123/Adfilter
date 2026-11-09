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

/**
 * Quét toàn bộ thẻ iframe trong cây DOM, nếu phát hiện iframe có kích thước khớp với
 * banner IAB thì tự động ẩn thẻ iframe và container cha của nó với display: none !important.
 * @returns Số lượng phần tử quảng cáo đã được ẩn
 */
export function scanAndHideHeuristicAds(root: Document | HTMLElement = document): number {
  let count = 0;
  const iframes = root.querySelectorAll('iframe');

  iframes.forEach((iframe) => {
    const rect = iframe.getBoundingClientRect();
    if (isIabBannerSize(rect.width, rect.height)) {
      const container = iframe.closest('div') || iframe;
      (container as HTMLElement).style.setProperty('display', 'none', 'important');
      (container as HTMLElement).style.setProperty('height', '0px', 'important');
      (container as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
      count++;
    }
  });

  return count;
}