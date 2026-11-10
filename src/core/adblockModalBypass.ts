/**
 * Tự động phát hiện và gỡ bỏ các modal cảnh báo Adblock, backdrop làm mờ trang
 * và khôi phục toàn bộ quyền cuộn chuột cũng như click chuột cho người đọc truyện.
 * @returns Số lượng phần tử modal/overlay cảnh báo đã bị xóa
 */
export function bypassAdblockModals(doc: Document = document): number {
  let count = 0;
  const modalSelectors = [
    '.adblock-modal',
    '#adblock-modal',
    '.adblock-overlay',
    '#adblock-overlay',
    '.block-adblock',
    '.has-adblock-modal',
    '[class*="adblock-warning"]',
    '[id*="adblock-warning"]',
    '[class*="adblock-backdrop"]',
    '[id*="adblock-backdrop"]',
  ].join(', ');

  const modals = doc.querySelectorAll(modalSelectors);
  modals.forEach((m) => {
    m.remove();
    count++;
  });

  // Khôi phục hiệu ứng làm mờ và con trỏ chuột trên thẻ <body>
  if (doc.body) {
    if (doc.body.style.filter && doc.body.style.filter.includes('blur')) {
      doc.body.style.setProperty('filter', 'none', 'important');
    }
    doc.body.classList.remove('modal-open', 'has-adblock-modal', 'blur-backdrop', 'no-scroll');
    doc.body.style.setProperty('pointer-events', 'auto', 'important');
  }

  // Khôi phục thanh cuộn trên <html>
  if (doc.documentElement) {
    if (doc.documentElement.style.overflow === 'hidden' || doc.documentElement.style.overflowY === 'hidden') {
      doc.documentElement.style.setProperty('overflow', 'auto', 'important');
      doc.documentElement.style.setProperty('overflow-y', 'auto', 'important');
    }
    doc.documentElement.style.setProperty('pointer-events', 'auto', 'important');
  }

  return count;
}
