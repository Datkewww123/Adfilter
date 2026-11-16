import {
  isCrossOriginUrl,
  isGamblingMorphologyMatch,
} from '../stealth/gamblingMorphology';

const BETTING_AD_SELECTOR = [
  'a[href*="sunwin"]',
  'a[href*="gemwin"]',
  'a[href*="zowin"]',
  'a[href*="zo88"]',
  'a[href*="yo88"]',
  'a[href*="bom88"]',
  'a[href*="vsbet"]',
  'a[href*="hdbet"]',
  'a[href*="3bet"]',
  'a[href*="sun88"]',
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
  'img[src*="hdbet" i]',
  'img[src*="3bet" i]',
  'img[src*="sun88" i]',
  'img[src*="yo88" i]',
  'img[src*="zo88" i]',
  'img[src*="bom88" i]',
  'img[src*="hitclub" i]',
  'img[alt*="vsbet" i]',
  'img[alt*="hdbet" i]',
  'img[alt*="3bet" i]',
  'img[alt*="sun88" i]',
  'img[alt*="yo88" i]',
  'img[alt*="zo88" i]',
  'img[alt*="bom88" i]',
  'img[alt*="hitclub" i]',
].join(', ');

const SAFE_MODAL_KEYWORDS =
  /login|signin|sign-in|register|search|chapter|menu|nav|player|video|episode|comment|cookie-settings/i;
const CLOSE_CONTROL_TEXT_REGEX = /^[×✕✖xX]$|^đóng(?:\s*quảng\s*cáo)?$|^close$/i;

function hideFloatingElement(el: HTMLElement): void {
  el.style.setProperty('display', 'none', 'important');
  el.style.setProperty('height', '0px', 'important');
  el.style.setProperty('visibility', 'hidden', 'important');
  el.style.setProperty('pointer-events', 'none', 'important');
}

function hasCloseControl(el: HTMLElement): boolean {
  if (
    el.querySelector(
      '[class*="close" i], [id*="close" i], [aria-label*="close" i], [aria-label*="đóng" i]'
    )
  ) {
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

function hasMorphologicalOrCrossOriginAdMedia(
  el: HTMLElement,
  currentHost: string,
  isEdgeBar: boolean
): boolean {
  const linkedImages = el.querySelectorAll<HTMLImageElement>('a[href] img');
  if (linkedImages.length === 0) return false;

  for (const img of Array.from(linkedImages)) {
    const anchor = img.closest('a');
    const href = anchor?.getAttribute('href') || (anchor as HTMLAnchorElement | null)?.href || '';
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const title = img.getAttribute('title') || '';

    if (isGamblingMorphologyMatch(href, src, alt, title, currentHost)) {
      return true;
    }

    if (isEdgeBar) {
      const rect = img.getBoundingClientRect?.();
      const isHorizontalStrip = Boolean(
        rect && rect.width >= 200 && rect.height >= 24 && rect.height <= 160 && rect.width / rect.height >= 2.2
      );
      const isGifOrExternal =
        /\.gif(?:$|\?)/i.test(src) ||
        isCrossOriginUrl(href, currentHost) ||
        anchor?.getAttribute('target')?.toLowerCase() === '_blank';
      const hasMinimalText = (el.textContent || '').trim().length <= 40;
      if ((isHorizontalStrip || hasCloseControl(el)) && isGifOrExternal && hasMinimalText) {
        return true;
      }
    }
  }

  return false;
}

function isDimmedAdModal(
  el: HTMLElement,
  style: CSSStyleDeclaration,
  identifier: string,
  doc: Document,
  currentHost: string
): boolean {
  if (SAFE_MODAL_KEYWORDS.test(identifier) || el.querySelector('form, input, textarea, select')) {
    return false;
  }

  const zIndexRaw = parseInt(style.zIndex || el.style.zIndex || '0', 10);
  if (isNaN(zIndexRaw) || zIndexRaw < 50) return false;

  const win = doc.defaultView;
  const rect = el.getBoundingClientRect?.();
  const isFullscreenInset =
    el.style.inset === '0' ||
    el.style.inset === '0px' ||
    ((style.top === '0px' || el.style.top === '0px') &&
      (style.left === '0px' || el.style.left === '0px') &&
      (style.width === '100%' ||
        el.style.width === '100%' ||
        style.right === '0px' ||
        el.style.right === '0px'));
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

  const hasAdTarget =
    Boolean(
      el.querySelector(
        'a[target="_blank"] img, a[href] img[src*=".gif" i], iframe[src*="ad" i], iframe[src*="banner" i], iframe[src*="pop" i]'
      ) || el.querySelector(BETTING_AD_SELECTOR)
    ) || hasMorphologicalOrCrossOriginAdMedia(el, currentHost, false);

  return hasAdTarget && hasCloseControl(el);
}

function checkAndHideFloatingElement(
  htmlEl: HTMLElement,
  doc: Document,
  currentHost: string
): boolean {
  if (!htmlEl || htmlEl.style?.display === 'none') return false;
  const tag = htmlEl.tagName;
  if (tag !== 'DIV' && tag !== 'ASIDE' && tag !== 'SECTION') return false;
  if (htmlEl.closest('header, nav') || htmlEl.querySelector('nav, form, input, video')) return false;

  const view = doc.defaultView || window;
  const style = view.getComputedStyle ? view.getComputedStyle(htmlEl) : htmlEl.style;
  const position = style.position || htmlEl.style.position;
  if (position !== 'fixed' && position !== 'sticky') return false;

  const bottomVal = parseInt(style.bottom || htmlEl.style.bottom, 10);
  const topVal = parseInt(style.top || htmlEl.style.top, 10);
  const isBottomSticky = !isNaN(bottomVal) && bottomVal >= 0 && bottomVal <= 80;
  const isTopSticky = !isNaN(topVal) && topVal >= 0 && topVal <= 80;

  const leftVal = parseInt(style.left || htmlEl.style.left, 10);
  const rightVal = parseInt(style.right || htmlEl.style.right, 10);
  const widthVal = parseInt(style.width || htmlEl.style.width, 10);
  const isSideSticky =
    ((!isNaN(leftVal) && leftVal >= 0 && leftVal <= 80) ||
      (!isNaN(rightVal) && rightVal >= 0 && rightVal <= 80)) &&
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

  const isEdgeStickyBar = (isBottomSticky || isTopSticky || isSideSticky) && !SAFE_MODAL_KEYWORDS.test(identifier);
  const isBehaviorCatfish =
    isEdgeStickyBar && hasMorphologicalOrCrossOriginAdMedia(htmlEl, currentHost, true);

  const isBlurredPopupModal = isDimmedAdModal(htmlEl, style, identifier, doc, currentHost);

  if (
    isExplicitFloatFlank ||
    containsBettingAd ||
    isExtremeAdOverlay ||
    isBehaviorCatfish ||
    isBlurredPopupModal ||
    ((isBottomSticky || isSideSticky) && hasAdKeyword)
  ) {
    hideFloatingElement(htmlEl);
    return true;
  }

  return false;
}

/**
 * Quét đồng bộ 0ms trên một cây con vừa được chèn vào DOM hoặc vừa thay đổi hiển thị
 * để ẩn ngay trước khi trình duyệt kịp paint khung hình tiếp theo (Zero-Flash).
 */
export function purgeFloatingElementSubtree(root: HTMLElement, doc: Document = document): number {
  let count = 0;
  const currentHost = doc.location?.hostname || '';
  if (
    root.matches?.('[data-adfilter-shadow-ad="1"], div.w-overlay, div[class*="w-overlay-"]') &&
    root.style.display !== 'none'
  ) {
    hideFloatingElement(root);
    return 1;
  }
  if (checkAndHideFloatingElement(root, doc, currentHost)) {
    count++;
  }
  root.querySelectorAll<HTMLElement>('div, aside, section').forEach((child) => {
    if (checkAndHideFloatingElement(child, doc, currentHost)) {
      count++;
    }
  });
  return count;
}

/**
 * Quét và xóa bỏ các banner dính cố định (fixed/sticky) ở chân trang, đỉnh, hai bên sườn
 * (không phụ thuộc tên class/id hoặc tên nhà cái), popup làm mờ nền có nút X,
 * vỏ bọc Closed Shadow DOM widget và mở khóa cuộn trang.
 */
export function purgeFloatingAds(doc: Document = document): number {
  let count = 0;
  const currentHost = doc.location?.hostname || '';

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
    if (checkAndHideFloatingElement(el as HTMLElement, doc, currentHost)) {
      count++;
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
