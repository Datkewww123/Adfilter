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
      const bottom = style.bottom || htmlEl.style.bottom;
      const isBottomSticky = parseInt(bottom, 10) === 0 || bottom === '0px';

      const left = style.left || htmlEl.style.left;
      const right = style.right || htmlEl.style.right;
      const isSideSticky =
        (parseInt(left, 10) === 0 || left === '0px' || parseInt(right, 10) === 0 || right === '0px') &&
        (parseInt(style.width, 10) <= 250 || parseInt(htmlEl.style.width, 10) <= 250);

      const identifier = `${htmlEl.className} ${htmlEl.id}`;
      const hasAdKeyword = /ad|banner|qc|quangcao|floating|sticky-bottom/i.test(identifier);

      if ((isBottomSticky || isSideSticky) && hasAdKeyword) {
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