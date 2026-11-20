import {
  isSecurityChallengeUrl,
  isSecurityWidgetElement,
} from '../core/securityChallenge';
import {
  isCrossOriginUrl,
  isGamblingMorphologyMatch,
} from '../stealth/gamblingMorphology';
import { isSuspiciousUrl } from '../stealth/urlBlockRegistry';
import { isContentListOrLayoutContainer } from './contentSafety';

// Các kích thước chuẩn của banner quảng cáo IAB (dung sai +/- 5px)
export const IAB_SIZES = [
  { w: 300, h: 250 }, // Medium Rectangle (khung chữ nhật phổ biến trong bài đọc truyện)
  { w: 728, h: 90 },  // Leaderboard (banner ngang đầu/cuối trang)
  { w: 160, h: 600 }, // Wide Skyscraper (banner dọc hai bên sườn)
  { w: 320, h: 50 },  // Mobile Leaderboard (banner chân trang mobile)
  { w: 300, h: 600 }, // Half Page (banner chữ nhật lớn)
  { w: 970, h: 250 }, // Billboard (banner siêu lớn đỉnh trang)
];

const EXTERNAL_BANNER_CDN_REGEX = /mplmncb\.com|yougetwhatyoupayfor\.net|bncloudfl\.com/i;
const PROTECTED_PLAYER_IFRAME_REGEX =
  /(?:player|embed|youtube|vimeo|stream|captcha|recaptcha|hcaptcha|turnstile|cloudflare|arkoselabs|funcaptcha|datadome|captcha-delivery|geetest|awswaf|ddos-guard|challenge)/i;
const AD_NETWORK_IFRAME_REGEX =
  /exoclick|exosrv|magsrv|realsrv|pemsrv|tsyndicate|juicyads|jads\.co|trafficjunky|trafficstars|betteradsystem|adsterra|a-ads|adskeeper|plugrush|bncloudfl|vandalcuculla/i;
const TRACKING_QUERY_REGEX =
  /[?&](?:zone|idzone|adzone|subid|campaign|clickid|pubid|bannerid|pid)=|\/tsk\//i;

/**
 * Kiểm tra xem kích thước phần tử có khớp với kích thước chuẩn IAB hay không (dung sai +/- 5px)
 */
export function isIabBannerSize(width: number, height: number): boolean {
  return IAB_SIZES.some(
    (size) => Math.abs(size.w - width) <= 5 && Math.abs(size.h - height) <= 5
  );
}

function hideAdContainer(container: HTMLElement): void {
  container.style.setProperty('display', 'none', 'important');
  container.style.setProperty('height', '0px', 'important');
  container.style.setProperty('visibility', 'hidden', 'important');
  container.style.setProperty('pointer-events', 'none', 'important');
}

function isProtectedContentZone(
  el: HTMLElement,
  doc?: Document,
  allowSingleIframe = false
): boolean {
  return isContentListOrLayoutContainer(el, doc, { allowSingleIframe });
}

function isAdWidgetIframe(
  iframe: Element,
  rect: DOMRect | undefined,
  currentHost: string
): boolean {
  const src = (iframe.getAttribute('src') || '').trim();
  if (
    PROTECTED_PLAYER_IFRAME_REGEX.test(src) ||
    isSecurityChallengeUrl(src) ||
    isSecurityWidgetElement(iframe)
  ) {
    return false;
  }

  const id = iframe.id || '';
  if (/^__clb-spot_/i.test(id)) return true;
  if (src && AD_NETWORK_IFRAME_REGEX.test(src)) return true;

  const sandbox = iframe.getAttribute('sandbox') || '';
  const isBlankSrc = !src || src === 'about:blank';
  if (isBlankSrc && /allow-popups-to-escape-sandbox/i.test(sandbox)) {
    return true;
  }

  if (!rect) return false;
  if (isIabBannerSize(rect.width, rect.height)) {
    return true;
  }

  const isWideWidgetShape = rect.width >= 400 && rect.height >= 120 && rect.height <= 360;
  const inAdSlot = Boolean(
    iframe.closest(
      '.my_banner, [class*="banner" i], [id*="banner" i], [id^="__clb-spot_"], [class*="ad-" i], [data-zoneid], [data-idzone]'
    )
  );
  return (
    isWideWidgetShape &&
    inAdSlot &&
    (isBlankSrc || isCrossOriginUrl(src, currentHost))
  );
}

function hideElementOrSafeWrapper(
  el: HTMLElement,
  wrapperSelector: string,
  ownerDoc?: Document,
  allowSingleIframe = false
): number {
  const wrapper = el.closest<HTMLElement>(wrapperSelector);
  const target =
    wrapper && !isProtectedContentZone(wrapper, ownerDoc, allowSingleIframe) ? wrapper : el;
  if (target.style.display === 'none') return 0;
  hideAdContainer(target);
  return 1;
}

function hideNoLinkAndBlankFrameAds(
  root: Document | HTMLElement,
  ownerDoc: Document | undefined,
  currentHost: string
): number {
  let count = 0;
  const isBlankFrame =
    ownerDoc?.location?.href === 'about:blank' || ownerDoc?.URL === 'about:blank';

  // 1. Khung widget & ảnh dùng thuộc tính JS click (`my_banner`, `__clb-spot_`, `g-role="img"`, `/tsk/`)
  root
    .querySelectorAll<HTMLElement>(
      '.my_banner, [id^="__clb-spot_"], img[g-role="img"], img[src*="/tsk/"], img[src*="bncloudfl.com"]'
    )
    .forEach((node) => {
      if (node.matches('.my_banner, [id^="__clb-spot_"]')) {
        if (!isProtectedContentZone(node, ownerDoc, true) && node.style.display !== 'none') {
          hideAdContainer(node);
          count++;
        }
        return;
      }
      count += hideElementOrSafeWrapper(
        node,
        '.my_banner, [id^="__clb-spot_"], div[style*="grid-template-columns" i]',
        ownerDoc,
        true
      );
    });

  // 2. Lưới Native Ads dựng bằng CSS Grid không thẻ <a> (kiểu `div.I8Y5R > 4x div > img[g-role="img"]`)
  const view = ownerDoc?.defaultView || (typeof window !== 'undefined' ? window : undefined);
  root.querySelectorAll<HTMLElement>('div').forEach((gridDiv) => {
    if (gridDiv.style.display === 'none') return;
    if (
      gridDiv.querySelector('form, input, textarea, [contenteditable="true"], video, nav, header, footer, a[href^="/"]')
    ) {
      return;
    }
    const styleAttr = (gridDiv.getAttribute('style') || '').toLowerCase();
    const computed = view?.getComputedStyle?.(gridDiv);
    const hasGridCols =
      styleAttr.includes('grid-template-columns') ||
      (computed?.display === 'grid' && Boolean(computed.gridTemplateColumns));
    if (!hasGridCols) return;

    const zIndexRaw = parseInt(computed?.zIndex || gridDiv.style.zIndex || '0', 10);
    const hasExtremeZ = !isNaN(zIndexRaw) && zIndexRaw >= 2_000_000_000;
    const imgs = gridDiv.querySelectorAll('img');
    const hasAdCue =
      isBlankFrame ||
      hasExtremeZ ||
      Boolean(gridDiv.querySelector('img[g-role="img"], img[src*="/tsk/"], img[src*="bncloudfl"]'));

    if (hasAdCue && imgs.length >= 2 && imgs.length <= 8) {
      hideAdContainer(gridDiv);
      count++;
    }
  });

  // 3. Bên trong `#document (about:blank)` iframe: banner <img> đơn lẻ dùng `cursor: pointer`
  if (isBlankFrame && !root.querySelector('form, input, textarea, [contenteditable="true"], video')) {
    root.querySelectorAll<HTMLImageElement>('img').forEach((imgEl) => {
      if (imgEl.style.display === 'none') return;
      const src = imgEl.getAttribute('src') || '';
      const rect = imgEl.getBoundingClientRect?.();
      const cursor = (imgEl.style.cursor || '').toLowerCase();
      const isClickableBannerImg =
        cursor === 'pointer' ||
        Boolean(rect && isIabBannerSize(rect.width, rect.height)) ||
        TRACKING_QUERY_REGEX.test(src);
      if (!isClickableBannerImg) return;

      count += hideElementOrSafeWrapper(imgEl, 'div', ownerDoc, false);
    });
  }

  // 4. Dải Native Ads có thẻ <a> đều là target="_blank" trỏ cross-origin kèm tracking URL (2–8 card)
  root.querySelectorAll<HTMLElement>('div, aside, section').forEach((container) => {
    if (container.style.display === 'none') return;
    if (container.closest('header, nav, footer')) return;
    if (container.querySelector('form, input, textarea, video, nav, header, footer, ul li + li')) {
      return;
    }

    const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'));
    if (anchors.length < 2 || anchors.length > 8) return;

    let hasTrackingOrAdSignal = false;
    const allCrossOriginBlankWithImg = anchors.every((a) => {
      const targetAttr = (a.getAttribute('target') || '').toLowerCase();
      const href = a.getAttribute('href') || a.href || '';
      const img = a.querySelector('img');
      if (!img || targetAttr !== '_blank' || !isCrossOriginUrl(href, currentHost)) {
        return false;
      }
      const imgSrc = img.getAttribute('src') || '';
      if (
        isSuspiciousUrl(href) ||
        isSuspiciousUrl(imgSrc) ||
        isGamblingMorphologyMatch(href, imgSrc, img.alt || '', img.title || '', currentHost) ||
        TRACKING_QUERY_REGEX.test(href) ||
        TRACKING_QUERY_REGEX.test(imgSrc)
      ) {
        hasTrackingOrAdSignal = true;
      }
      return true;
    });

    if (allCrossOriginBlankWithImg && hasTrackingOrAdSignal) {
      hideAdContainer(container);
      count++;
    }
  });

  return count;
}

/**
 * Quét toàn bộ thẻ iframe quảng cáo (IAB + about:blank sandbox), lưới Native Ads (kể cả không thẻ <a>)
 * và banner quảng cáo ngoài trong thẻ <a>, đồng thời bảo toàn tuyệt đối danh sách truyện/chương/phim.
 */
export function scanAndHideHeuristicAds(root: Document | HTMLElement = document): number {
  let count = 0;
  const ownerDoc = root.nodeType === 9 ? (root as Document) : root.ownerDocument || undefined;
  const currentHost =
    (root as Document).location?.hostname ||
    root.ownerDocument?.location?.hostname ||
    (typeof window !== 'undefined' ? window.location?.hostname || '' : '');

  const iframes = root.querySelectorAll('iframe');
  iframes.forEach((iframe) => {
    const rect = iframe.getBoundingClientRect?.();
    if (!isAdWidgetIframe(iframe, rect, currentHost)) {
      return;
    }
    const closestDiv = iframe.closest('div') as HTMLElement | null;
    const container =
      closestDiv && !isProtectedContentZone(closestDiv, ownerDoc, true)
        ? closestDiv
        : (iframe as unknown as HTMLElement);
    if (container.style.display !== 'none') {
      hideAdContainer(container);
      count++;
    }
  });

  count += hideNoLinkAndBlankFrameAds(root, ownerDoc, currentHost);

  // Quét banner ảnh quảng cáo bọc trong liên kết (hình thái + tỷ lệ ngang dẹt trỏ cross-origin)
  root.querySelectorAll<HTMLImageElement>('a[href] img').forEach((imgEl) => {
    const anchor = imgEl.closest('a') as HTMLAnchorElement | null;
    if (!anchor) return;
    if (anchor.closest('.movie-item, .film-item, .manga-item, #real-article, header, nav, footer')) {
      return;
    }

    const src = imgEl.getAttribute('src') || '';
    const alt = imgEl.getAttribute('alt') || '';
    const title = imgEl.getAttribute('title') || '';
    const href = anchor.getAttribute('href') || anchor.href || '';

    const isCdnOrMorphology =
      EXTERNAL_BANNER_CDN_REGEX.test(src) ||
      isGamblingMorphologyMatch(href, src, alt, title, currentHost);

    let isCrossOriginStripBanner = false;
    if (!isCdnOrMorphology) {
      const rect = imgEl.getBoundingClientRect?.();
      const isLeaderboardShape = Boolean(
        rect && rect.width >= 260 && rect.height >= 30 && rect.height <= 140 && rect.width / rect.height >= 2.5
      );
      const isExternalAnchor =
        isCrossOriginUrl(href, currentHost) ||
        anchor.getAttribute('target')?.toLowerCase() === '_blank';
      const anchorTextLen = (anchor.textContent || '').trim().length;
      if (isLeaderboardShape && isExternalAnchor && anchorTextLen <= 12) {
        isCrossOriginStripBanner = true;
      }
    }

    if (!isCdnOrMorphology && !isCrossOriginStripBanner) return;

    const candidate = anchor.closest('div, aside, section') as HTMLElement | null;
    const target =
      candidate && !isProtectedContentZone(candidate, ownerDoc, false) ? candidate : anchor;

    if (target.style.display !== 'none') {
      hideAdContainer(target);
      count++;
    }
  });

  return count;
}
