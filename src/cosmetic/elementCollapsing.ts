const EXPLICIT_AD_TOKEN_REGEX = /(?:^|[\s_-])(?:ads?|adsbox|banner-ads?|ad-container|ad-holder|ads-wrapper)(?:$|[\s_-]|\d)/i;

/**
 * Quét các khung chứa quảng cáo bị rỗng sau khi banner bị chặn,
 * ép chiều cao về 0px và xóa sạch margin/padding để không làm hở layout trang web
 * (tuyệt đối không co rút khung chứa video, iframe player hoặc nút điều khiển).
 */
export function collapseEmptyAdSlots(doc: Document = document): number {
  let count = 0;
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

    // Tránh khớp nhầm từ có chứa chuỗi "ad-" bên trong như "load-", "head-", "shadow-"
    const idAndClass = `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`;
    if (!EXPLICIT_AD_TOKEN_REGEX.test(idAndClass)) {
      return;
    }

    // Tuyệt đối không co rút nếu khung có chứa trình phát video, iframe hoặc điều khiển hợp lệ
    if (el.querySelector('video, iframe, canvas, button, input, form')) {
      return;
    }

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
