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
 * Ẩn triệt để các khung chứa quảng cáo đè lên trình phát video
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
  ].join(', ');

  const overlays = doc.querySelectorAll<HTMLElement>(overlaySelectors);
  let count = 0;

  overlays.forEach((el) => {
    el.style.setProperty('display', 'none', 'important');
    count++;
  });

  return count;
}
