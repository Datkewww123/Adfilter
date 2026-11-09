/**
 * Quét các khung chứa quảng cáo bị rỗng sau khi banner bị chặn,
 * ép chiều cao về 0px và xóa sạch margin/padding để không làm hở layout trang web.
 * @returns Số lượng khung quảng cáo rỗng đã bị co rút
 */
export function collapseEmptyAdSlots(doc: Document = document): number {
  let count = 0;
  // Các selector đặc thù của khung chứa quảng cáo trên web truyện/phim
  const selector = [
    '[id*="ad-"]',
    '[id*="ads-"]',
    '[class*="ad-"]',
    '[class*="ads-"]',
    '[class*="adsbox"]',
    '[id*="banner-ads"]',
    '[class*="banner-ads"]',
    '.ad-container',
    '.ad-holder',
  ].join(', ');

  const adHolders = doc.querySelectorAll(selector);

  adHolders.forEach((holder) => {
    const el = holder as HTMLElement;

    // Kiểm tra nếu phần tử rỗng: không có con hiển thị hoặc chỉ chứa khoảng trắng thừa
    const hasVisibleChildren = Array.from(el.children).some((child) => {
      const childEl = child as HTMLElement;
      return childEl.style.display !== 'none' && childEl.offsetHeight > 0;
    });

    const isTextEmpty = !el.textContent || el.textContent.trim() === '';

    if (!hasVisibleChildren && isTextEmpty) {
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('height', '0px', 'important');
      el.style.setProperty('min-height', '0px', 'important');
      el.style.setProperty('max-height', '0px', 'important');
      el.style.setProperty('margin', '0px', 'important');
      el.style.setProperty('padding', '0px', 'important');
      el.style.setProperty('border', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      count++;
    }
  });

  return count;
}