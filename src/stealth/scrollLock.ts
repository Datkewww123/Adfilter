/**
 * Scroll Lock — Mở khóa thanh cuộn YouTube sau khi extension gỡ popup chặn quảng cáo.
 *
 * YouTube không khóa cuộn bằng inline style mà bằng class CSS:
 *   body.no-scroll   { overflow: hidden; }
 *   body.no-y-scroll { overflow-y: hidden; }
 *
 * Vì vậy chỉ xóa `style.overflow` là không đủ. Module này xóa đúng class +
 * inline style trên body/html/ytd-app, nhưng chỉ khi không còn dialog thật
 * đang mở để không phá các hộp thoại Share / Settings / Report của YouTube.
 */

export const SCROLL_LOCK_CLASSES = ['no-scroll', 'no-y-scroll'] as const;

/** Dialog thuộc hệ thống cảnh báo chặn quảng cáo — không được coi là dialog thật. */
const ENFORCEMENT_DIALOG_SELECTOR = [
  'ytd-enforcement-message-view-model',
  'tp-yt-paper-dialog.ytd-enforcement-message-view-model',
  '#enforce-dialog',
].join(', ');

/** Các loại dialog có thể khóa cuộn trang của YouTube. */
const DIALOG_SELECTOR = ['tp-yt-paper-dialog', 'ytd-popup-modal', '[role="dialog"]'].join(', ');

function isVisible(el: Element): boolean {
  if (!el.isConnected) return false;
  if (el.hasAttribute('hidden')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;

  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Trả về true nếu đang có một dialog thật (không phải popup chặn quảng cáo)
 * hiển thị trên màn hình. Khi đó không được tự ý mở khóa cuộn.
 */
export function hasBlockingDialog(doc: Document): boolean {
  const dialogs = Array.from(doc.querySelectorAll<HTMLElement>(DIALOG_SELECTOR));
  for (const el of dialogs) {
    if (el.closest(ENFORCEMENT_DIALOG_SELECTOR)) continue;
    if (el.querySelector(ENFORCEMENT_DIALOG_SELECTOR)) continue;
    if (isVisible(el)) return true;
  }
  return false;
}

function unlockElement(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove(...SCROLL_LOCK_CLASSES);
  if (el.style.overflow === 'hidden') el.style.removeProperty('overflow');
  if (el.style.overflowY === 'hidden') el.style.removeProperty('overflow-y');
}

/**
 * Gỡ bỏ class + inline style khóa cuộn trên các phần tử gốc của YouTube.
 * Không kiểm tra dialog — dùng khi đã chắc chắn không có modal thật.
 */
export function unlockScroll(doc: Document): void {
  unlockElement(doc.body);
  unlockElement(doc.documentElement);
  unlockElement(doc.querySelector<HTMLElement>('ytd-app'));
}

/**
 * Mở khóa cuộn nếu không có dialog thật đang mở.
 * @returns true nếu đã thực hiện mở khóa.
 */
export function releaseScrollLockIfSafe(doc: Document): boolean {
  if (hasBlockingDialog(doc)) return false;
  unlockScroll(doc);
  return true;
}
