const BETTING_AD_SELECTOR = [
  'a[href*="sunwin"]',
  'a[href*="gemwin"]',
  'a[href*="zowin"]',
  'a[href*="nhatvip"]',
  'a[href*="five88"]',
  'a[href*="red88"]',
  'a[href*="rikvip"]',
  'a[href*="win79"]',
  'a[href*="debet"]',
  'a[href*="big88"]',
  'img[src*="mplmncb.com"]',
].join(', ');

/**
 * Quét và xóa bỏ các banner dính cố định (fixed/sticky) ở chân trang hoặc hai bên sườn
 * và mở khóa cuộn trang nếu bị website đọc truyện khóa overflow.
 * @returns Số lượng phần tử quảng cáo dính đã bị xử lý
 */
export function purgeFloatingAds(doc: Document = document): number {
  let count = 0;
  const elements = doc.querySelectorAll('div, aside, section');

  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const view = doc.defaultView || window;
    const style = view.getComputedStyle ? view.getComputedStyle(htmlEl) : htmlEl.style;

    const position = style.position || htmlEl.style.position;
    if (position === 'fixed' || position === 'sticky') {
      const bottomVal = parseInt(style.bottom || htmlEl.style.bottom, 10);
      const isBottomSticky = !isNaN(bottomVal) && bottomVal >= 0 && bottomVal <= 50;

      const leftVal = parseInt(style.left || htmlEl.style.left, 10);
      const rightVal = parseInt(style.right || htmlEl.style.right, 10);
      const widthVal = parseInt(style.width || htmlEl.style.width, 10);
      const isSideSticky =
        ((!isNaN(leftVal) && leftVal >= 0 && leftVal <= 50) ||
          (!isNaN(rightVal) && rightVal >= 0 && rightVal <= 50)) &&
        (isNaN(widthVal) || widthVal <= 300);

      const identifier = `${htmlEl.className} ${htmlEl.id}`;
      const hasAdKeyword = /ad|banner|qc|quangcao|floating|sticky-bottom|catfish|float[-_]?(left|right)/i.test(
        identifier
      );
      const isExplicitFloatFlank = /float[-_]?(left|right)|floating[-_]?(left|right)|catfish/i.test(identifier);
      const containsBettingAd = Boolean(htmlEl.querySelector(BETTING_AD_SELECTOR));

      if (
        isExplicitFloatFlank ||
        containsBettingAd ||
        ((isBottomSticky || isSideSticky) && hasAdKeyword)
      ) {
        htmlEl.style.setProperty('display', 'none', 'important');
        htmlEl.style.setProperty('height', '0px', 'important');
        htmlEl.style.setProperty('visibility', 'hidden', 'important');
        count++;
      }
    }
  });

  // Khôi phục cuộn trang nếu trang web cố tình khóa scroll (overflow: hidden)
  if (doc.body && (doc.body.style.overflow === 'hidden' || doc.body.style.overflowY === 'hidden')) {
    doc.body.style.setProperty('overflow', 'auto', 'important');
    doc.body.style.setProperty('overflow-y', 'auto', 'important');
  }
  if (
    doc.documentElement &&
    (doc.documentElement.style.overflow === 'hidden' || doc.documentElement.style.overflowY === 'hidden')
  ) {
    doc.documentElement.style.setProperty('overflow', 'auto', 'important');
    doc.documentElement.style.setProperty('overflow-y', 'auto', 'important');
  }

  return count;
}