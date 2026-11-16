const BETTING_AD_SELECTOR = [
  'a[href*="sunwin"]',
  'a[href*="gemwin"]',
  'a[href*="zowin"]',
  'a[href*="zo88"]',
  'a[href*="yo88"]',
  'a[href*="bom88"]',
  'a[href*="vsbet"]',
  'a[href*="nhatvip"]',
  'a[href*="five88"]',
  'a[href*="red88"]',
  'a[href*="rikvip"]',
  'a[href*="win79"]',
  'a[href*="debet"]',
  'a[href*="big88"]',
  'a[href*="xo88"]',
  'a[href*="zbet"]',
  'a[href*="vin88"]',
  'a[href*="hitclub"]',
  'a[href*="hit.club"]',
  'a[href*="kubet"]',
  'a[href*="8xbet"]',
  'a[href*="shbet"]',
  'a[href*="jun88"]',
  'a[href*="789bet"]',
  'a[href*="new88"]',
  'a[href*="fb88"]',
  'a[href*="w88"]',
  'a[href*="fun88"]',
  'a[href*="chinhhang"]',
  'img[src*="mplmncb.com"]',
  'img[src*="yougetwhatyoupayfor.net"]',
  'img[src*="vsbet" i]',
  'img[src*="yo88" i]',
  'img[src*="zo88" i]',
  'img[src*="bom88" i]',
  'img[src*="hitclub" i]',
  'img[alt*="vsbet" i]',
  'img[alt*="yo88" i]',
  'img[alt*="zo88" i]',
  'img[alt*="bom88" i]',
  'img[alt*="hitclub" i]',
].join(', ');

const SAFE_MODAL_KEYWORDS = /login|signin|sign-in|register|search|chapter|menu|nav|player|video|episode|comment|cookie-settings/i;
const CLOSE_CONTROL_TEXT_REGEX = /^[×✕✖xX]$|^đóng(?:\s*quảng\s*cáo)?$|^close$/i;

function hideFloatingElement(el: HTMLElement): void {
  el.style.setProperty('display', 'none', 'important');
  el.style.setProperty('height', '0px', 'important');
  el.style.setProperty('visibility', 'hidden', 'important');
  el.style.setProperty('pointer-events', 'none', 'important');
}

function hasCloseControl(el: HTMLElement): boolean {
  if (el.querySelector('[class*="close" i], [id*="close" i], [aria-label*="close" i], [aria-label*="đóng" i]')) {
    return true;
  }
  const controls = el.querySelectorAll<HTMLElement>('button, a, span, div');
  for (const ctrl of Array.from(controls)) {
    const txt = (ctrl.textContent || '').trim();
    if (txt && txt.length <= 16 && CLOSE_CONTROL_TEXT_REGEX.test(txt)) {
      return true;
    }
  }
  return false;
}

function isDimmedAdModal(el: HTMLElement, style: CSSStyleDeclaration, identifier: string, doc: Document): boolean {
  if (SAFE_MODAL_KEYWORDS.test(identifier) || el.querySelector('form, input, textarea, select')) {
    return false;
  }

  const zIndexRaw = parseInt(style.zIndex || el.style.zIndex || '0', 10);
  if (isNaN(zIndexRaw) || zIndexRaw < 50) return false;

  const win = doc.defaultView;
  const rect = el.getBoundingClientRect?.();
  const isFullscreenInset =
    (el.style.inset === '0' || el.style.inset === '0px') ||
    ((style.top === '0px' || el.style.top === '0px') &&
      (style.left === '0px' || el.style.left === '0px') &&
      (style.width === '100%' || el.style.width === '100%' || style.right === '0px' || el.style.right === '0px'));
  const coversScreenRect = Boolean(
    rect &&
      win &&
      win.innerWidth > 0 &&
      win.innerHeight > 0 &&
      rect.width >= win.innerWidth * 0.7 &&
      rect.height >= win.innerHeight * 0.7
  );

  const bg = (style.backgroundColor || el.style.backgroundColor || '').toLowerCase();
  const backdrop = (style.backdropFilter || el.style.backdropFilter || '').toLowerCase();
  const isBackdropStyled = bg.includes('rgba(') || backdrop.includes('blur');

  if (!isFullscreenInset && !coversScreenRect && !isBackdropStyled) {
    return false;
  }

  const hasAdTarget = Boolean(
    el.querySelector(
      'a[target="_blank"] img, a[href] img[src*=".gif" i], iframe[src*="ad" i], iframe[src*="banner" i], iframe[src*="pop" i]'
    ) || el.querySelector(BETTING_AD_SELECTOR)
  );
  return hasAdTarget && hasCloseControl(el);
}

/**
 * Quét và xóa bỏ các banner dính cố định (fixed/sticky) ở chân trang, hai bên sườn,
 * popup làm mờ nền có nút X, vỏ bọc Closed Shadow DOM widget (`.w-overlay`, `[data-adfilter-shadow-ad]`)
 * và mở khóa cuộn trang nếu bị khóa overflow/blur.
 */
export function purgeFloatingAds(doc: Document = document): number {
  let count = 0;

  // 1. Ẩn ngay các host widget Closed Shadow DOM đã đánh dấu hoặc lớp .w-overlay
  doc
    .querySelectorAll<HTMLElement>(
      '[data-adfilter-shadow-ad="1"], div.w-overlay, div[class*="w-overlay-"]'
    )
    .forEach((host) => {
      if (host.style.display !== 'none') {
        hideFloatingElement(host);
        count++;
      }
    });

  const elements = doc.querySelectorAll('div, aside, section');

  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.style.display === 'none') return;

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

      const zIndexRaw = parseInt(style.zIndex || htmlEl.style.zIndex || '0', 10);
      const hasSuspiciousMedia = Boolean(
        htmlEl.querySelector('a[target="_blank"] img[src*=".gif" i], iframe[src*="ad" i]')
      );
      const isExtremeAdOverlay =
        !isNaN(zIndexRaw) &&
        zIndexRaw >= 2_000_000_000 &&
        !SAFE_MODAL_KEYWORDS.test(identifier) &&
        (hasSuspiciousMedia || htmlEl.children.length <= 2);

      const isBlurredPopupModal = isDimmedAdModal(htmlEl, style, identifier, doc);

      if (
        isExplicitFloatFlank ||
        containsBettingAd ||
        isExtremeAdOverlay ||
        isBlurredPopupModal ||
        ((isBottomSticky || isSideSticky) && hasAdKeyword)
      ) {
        hideFloatingElement(htmlEl);
        count++;
      }
    }
  });

  // Khôi phục cuộn trang và bỏ làm mờ nếu bị popup khóa overflow / filter
  if (doc.body) {
    if (doc.body.style.overflow === 'hidden' || doc.body.style.overflowY === 'hidden') {
      doc.body.style.setProperty('overflow', 'auto', 'important');
      doc.body.style.setProperty('overflow-y', 'auto', 'important');
    }
    if (doc.body.style.filter && doc.body.style.filter.includes('blur')) {
      doc.body.style.setProperty('filter', 'none', 'important');
    }
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
