import { installClickHijackGuard } from '../core/clickHijackGuard';
import {
  parseCosmeticRule,
  generateCosmeticCssFromIndex,
  matchesDomainOrSubdomain,
  type CosmeticIndex,
  type CosmeticRule,
  type ProceduralCosmeticRule,
} from '../cosmetic/cosmeticEngine';
import { applyProceduralCosmeticRules } from '../cosmetic/proceduralEngine';
import compiledCosmeticIndexJson from '../rules/cosmetic_index.json';
import { scanAndHideHeuristicAds } from '../cosmetic/heuristicAdDetector';
import {
  purgeFloatingAds,
  purgeFloatingElementSubtree,
} from '../cosmetic/floatingBannerGuard';
import { collapseEmptyAdSlots } from '../cosmetic/elementCollapsing';
import { bypassAdblockModals } from '../core/adblockModalBypass';
import { resolveLazyImages, startLazyLoadProtector } from '../core/lazyLoadProtector';
import { autoCloseMovieOverlays, purgeMoviePlayerAdOverlays } from '../core/videoOverlayCloser';
import { isDomainWhitelisted } from '../core/siteWhitelist';
import { startElementPicker } from './elementPicker';

// Danh sách các quy tắc CSS ẩn quảng cáo phổ biến trên web đọc truyện & web phim
export const COMMON_COSMETIC_RULES_RAW = [
  '##.ad-banner',
  '##.banner-ads',
  '##.adsbox',
  '##.ads-holder',
  '##.ad-container',
  '##.ad-wrapper',
  '##.ads-container',
  '##.box-advertisement',
  '##[id^="ad_"]',
  '##[id^="ads_"]',
  '##[class*="ad-slot"]',
  '##[class*="advertising"]',
  '##.floating-banner',
  '##.qc-sticky',
  '##.qc-left-side',
  '##.qc-right-side',
  // Bộ lọc đặc thù Web Truyện & Phim Việt Nam (TruyenQQ, NetTruyen...)
  '##div[id*="catfish-banner"]',
  '##div[id*="top-banner-"]',
  '##div[id*="bottom-banner-"]',
  '##div[id*="mid-banner-"]',
  '##div[id*="floatLeft"]',
  '##div[id*="floatRight"]',
  '##div[id*="floating-left"]',
  '##div[id*="floating-right"]',
  '##div[class*="float-left-banner"]',
  '##div[class*="float-right-banner"]',
  '##a[href*="sunwin"]',
  '##a[href*="gemwin"]',
  '##a[href*="debet"]',
  '##a[href*="rikvip"]',
  '##a[href*="win79"]',
  '##a[href*="zowin"]',
  '##a[href*="nhatvip"]',
  '##a[href*="five88"]',
  '##a[href*="red88"]',
  '##a[href*="big88"]',
  '##img[src*="mplmncb.com"]',
  '##[data-adfilter-shadow-ad="1"]',
  '##[data-adfilter-preblocked="1"]',
  '##div.w-overlay',
  '##div[class*="w-overlay-"]',
  // CSS :has() Zero-FOUC 0ms: ẩn trước khi vẽ đối với thanh fixed bottom/dimmed overlay chứa GIF/banner ngoài
  '##div[style*="position: fixed" i][style*="bottom: 0" i]:not(:has(form, input, textarea, select, nav, video)):has(a[target="_blank"] img)',
  '##div[style*="position:fixed" i][style*="bottom:0" i]:not(:has(form, input, textarea, select, nav, video)):has(a[target="_blank"] img)',
  '##div[style*="position: fixed" i][style*="rgba(" i]:not(:has(form, input, textarea, select, nav, video)):has(a[target="_blank"] img)',
  '##div[style*="position:fixed" i][style*="rgba(" i]:not(:has(form, input, textarea, select, nav, video)):has(a[target="_blank"] img)',
];

const COMPILED_COSMETIC_INDEX = compiledCosmeticIndexJson as CosmeticIndex;

export const BUILTIN_COSMETIC_RULES: CosmeticRule[] = COMMON_COSMETIC_RULES_RAW
  .map((line) => parseCosmeticRule(line))
  .filter((r): r is CosmeticRule => r !== null);

/**
 * Tiêm chuỗi CSS ẩn quảng cáo vào thẻ <head> hoặc <documentElement> của trang web (Zero FOUC)
 */
export function injectCosmeticStyle(doc: Document = document): HTMLStyleElement | null {
  if (doc.getElementById('adfilter-cosmetic-styles')) {
    return null; // Đã tiêm rồi, không tiêm trùng lặp
  }

  const builtinSelectors = BUILTIN_COSMETIC_RULES.map((r) => r.selector);
  const css = generateCosmeticCssFromIndex(
    COMPILED_COSMETIC_INDEX,
    window.location.hostname,
    builtinSelectors
  );
  if (!css) return null;

  const styleEl = doc.createElement('style');
  styleEl.id = 'adfilter-cosmetic-styles';
  styleEl.textContent = css;

  const target = doc.head || doc.documentElement;
  if (target) {
    target.appendChild(styleEl);
  }
  return styleEl;
}

/**
 * Ẩn các phần tử do người dùng tự chọn bằng công cụ Element Zapper
 */
export function applyUserBlockedSelectors(doc: Document = document, selectors: string[] = []): void {
  if (!selectors.length) return;
  try {
    const combined = selectors.join(', ');
    const elements = doc.querySelectorAll(combined);
    elements.forEach((el) => {
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
    });
  } catch {
    // Bỏ qua nếu selector có lỗi cú pháp
  }
}

const VN_AD_CONTAINER_SELECTOR = [
  'div[id*="catfish-banner"]',
  'div[id*="top-banner-"]',
  'div[id*="bottom-banner-"]',
  'div[id*="mid-banner-"]',
  'div[id*="floatLeft"]',
  'div[id*="floatRight"]',
  'div[id*="floating-left"]',
  'div[id*="floating-right"]',
  '.box-advertisement',
  '.ads-container',
].join(', ');

const VN_BETTING_MEDIA_SELECTOR = [
  'a[href*="sunwin"]',
  'a[href*="gemwin"]',
  'a[href*="debet"]',
  'a[href*="rikvip"]',
  'a[href*="win79"]',
  'a[href*="zowin"]',
  'a[href*="nhatvip"]',
  'a[href*="five88"]',
  'a[href*="red88"]',
  'a[href*="big88"]',
  'a[href*="vsbet"]',
  'a[href*="bom88"]',
  'a[href*="yo88"]',
  'a[href*="zo88"]',
  'a[href*="hitclub"]',
  'a[href*="hit.club"]',
  'a[href*="8xbet"]',
  'a[href*="shbet"]',
  'a[href*="jun88"]',
  'a[href*="789bet"]',
  'a[href*="new88"]',
  'a[href*="fb88"]',
  'a[href*="w88"]',
  'a[href*="fun88"]',
  'img[src*="mplmncb.com"]',
  'img[src*="yougetwhatyoupayfor.net"]',
  'img[src*="vsbet" i]',
  'img[src*="bom88" i]',
  'img[src*="yo88" i]',
  'img[src*="zo88" i]',
  'img[src*="hitclub" i]',
  'img[alt*="vsbet" i]',
  'img[alt*="bom88" i]',
  'img[alt*="yo88" i]',
  'img[alt*="zo88" i]',
  'img[alt*="hitclub" i]',
].join(', ');

function hideElementCompletely(el: HTMLElement): void {
  el.style.setProperty('display', 'none', 'important');
  el.style.setProperty('height', '0px', 'important');
  el.style.setProperty('visibility', 'hidden', 'important');
}

/**
 * Quét và ẩn các cụm banner/popup cờ bạc đặc thù trên web đọc truyện & xem phim Việt Nam
 */
export function purgeVietnameseAdBanners(doc: Document = document): number {
  let count = 0;

  doc.querySelectorAll<HTMLElement>(VN_AD_CONTAINER_SELECTOR).forEach((container) => {
    hideElementCompletely(container);
    count++;
  });

  doc.querySelectorAll<HTMLElement>(VN_BETTING_MEDIA_SELECTOR).forEach((el) => {
    const adWrapper = el.closest<HTMLElement>(
      '[id*="banner"], [id*="catfish"], [id*="popup"], [id*="float"], [class*="banner"], [class*="popup"], [class*="modal"], .ads, .qc'
    );
    const target =
      adWrapper && adWrapper !== doc.body && adWrapper !== doc.documentElement ? adWrapper : el;
    hideElementCompletely(target);
    count++;
  });

  return count;
}

/**
 * Thực hiện một lượt quét dọn toàn diện: Heuristic IAB Ads + Floating Ads + Element Collapsing + Anti-Adblock Modal + Lazy Images + Movie Video Overlays + VN Manga Ads
 */
export function runCosmeticSweep(
  doc: Document = document,
  userSelectors: string[] = [],
  customProcedural: ProceduralCosmeticRule[] = []
): void {
  const host = typeof window !== 'undefined' ? window.location?.hostname ?? '' : '';
  scanAndHideHeuristicAds(doc);
  purgeFloatingAds(doc);
  purgeVietnameseAdBanners(doc);
  applyProceduralCosmeticRules(
    doc,
    [...(COMPILED_COSMETIC_INDEX.procedural ?? []), ...customProcedural],
    host
  );
  collapseEmptyAdSlots(doc);
  bypassAdblockModals(doc);
  resolveLazyImages(doc);
  autoCloseMovieOverlays(doc);
  purgeMoviePlayerAdOverlays(doc);
  applyUserBlockedSelectors(doc, userSelectors);
}

/**
 * Khởi động toàn bộ Universal Content Engine
 */
export function initUniversalContent(
  doc: Document = document,
  whitelist: string[] = []
): { cleanup: () => void; observer: MutationObserver } | null {
  const host = window.location.hostname;
  const isYouTube =
    host === 'youtube.com' ||
    host.endsWith('.youtube.com') ||
    host === 'youtube-nocookie.com' ||
    host.endsWith('.youtube-nocookie.com') ||
    Boolean(typeof window !== 'undefined' && window.location.pathname?.includes('watch.html'));

  if (isYouTube) {
    return null; // Đã có src/content/index.ts chuyên dụng cho YouTube
  }

  // 0. Bỏ qua nếu website nằm trong danh sách ngoại lệ (Per-Site Whitelist)
  if (isDomainWhitelisted(host, whitelist)) {
    return null;
  }

  // 1. Chống Click Hijacking & Lớp phủ tàng hình
  installClickHijackGuard(doc);

  // 2. Tiêm CSS ẩn quảng cáo tức thì tại document_start (Zero FOUC)
  injectCosmeticStyle(doc);

  let activeCustomSelectors: string[] = [];
  let activeCustomProcedural: ProceduralCosmeticRule[] = [];

  // 3. Quét dọn ban đầu
  runCosmeticSweep(doc, activeCustomSelectors, activeCustomProcedural);

  // 4. Lắng nghe sự kiện DOMContentLoaded và Window load
  if (doc.readyState === 'loading') {
    doc.addEventListener(
      'DOMContentLoaded',
      () => runCosmeticSweep(doc, activeCustomSelectors, activeCustomProcedural),
      { once: true }
    );
  }
  window.addEventListener(
    'load',
    () => runCosmeticSweep(doc, activeCustomSelectors, activeCustomProcedural),
    { once: true }
  );

  // 5. Khởi động bộ bảo vệ tải ảnh lười cho truyện tranh
  const stopLazyLoad = startLazyLoadProtector(doc);

  // 6. Thiết lập MutationObserver + bắt sự kiện Pause video để diệt Pause-Ad & Popup định kỳ tức thì
  let sweepTimer: any = null;
  const scheduleSweep = (delayMs = 150) => {
    if (sweepTimer) return;
    sweepTimer = setTimeout(() => {
      sweepTimer = null;
      runCosmeticSweep(doc, activeCustomSelectors, activeCustomProcedural);
    }, delayMs);
  };

  const handleVideoPause = () => {
    purgeMoviePlayerAdOverlays(doc);
    runCosmeticSweep(doc, activeCustomSelectors, activeCustomProcedural);
  };
  doc.addEventListener('pause', handleVideoPause, true);

  const observer = new MutationObserver((mutations) => {
    let shouldScheduleFallback = false;
    let needsPauseSweep = false;

    for (const m of mutations) {
      if (m.type === 'childList') {
        for (const node of Array.from(m.addedNodes)) {
          if (node.nodeType === 1) {
            const el = node as HTMLElement;
            // Xử lý đồng bộ 0ms trong microtask trước lần paint kế tiếp (Zero-Flash)
            purgeFloatingElementSubtree(el, doc);
            scanAndHideHeuristicAds(el);
            shouldScheduleFallback = true;
          }
        }
      } else if (m.type === 'attributes') {
        const el = m.target as HTMLElement;
        if (el && el !== doc.body && el !== doc.documentElement && el.style?.display !== 'none') {
          purgeFloatingElementSubtree(el, doc);
          needsPauseSweep = true;
          shouldScheduleFallback = true;
        }
      }
    }

    if (needsPauseSweep) {
      purgeMoviePlayerAdOverlays(doc);
    }
    if (shouldScheduleFallback) {
      scheduleSweep(100);
    }
  });

  const targetNode = doc.body || doc.documentElement;
  if (targetNode) {
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
    });
  }

  // 7. Cơ chế dọn dẹp chống rò rỉ bộ nhớ (Memory Leak Protection) khi người dùng đổi trang / đọc chapter mới
  const cleanup = () => {
    if (sweepTimer) {
      clearTimeout(sweepTimer);
      sweepTimer = null;
    }
    doc.removeEventListener('pause', handleVideoPause, true);
    observer.disconnect();
    stopLazyLoad();
    const styleEl = doc.getElementById('adfilter-cosmetic-styles');
    if (styleEl) styleEl.remove();
  };

  // 8. Đồng bộ whitelist, custom cosmetic rules và user picker selectors từ chrome.storage.local
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      chrome.storage.local.get(
        ['whitelist_domains', 'user_blocked_selectors', 'user_custom_cosmetic_rules'],
        (data: { [key: string]: any }) => {
          const stored: string[] = Array.isArray(data?.whitelist_domains)
            ? data.whitelist_domains
            : [];
          if (isDomainWhitelisted(host, stored)) {
            cleanup();
            return;
          }

          const customSelectors: string[] = Array.isArray(data?.user_blocked_selectors)
            ? [...data.user_blocked_selectors]
            : [];
          const customStore = data?.user_custom_cosmetic_rules as
            | {
                generic?: string[];
                byDomain?: Record<string, string[]>;
                procedural?: ProceduralCosmeticRule[];
              }
            | undefined;

          if (customStore) {
            if (Array.isArray(customStore.generic)) {
              customSelectors.push(...customStore.generic);
            }
            if (customStore.byDomain) {
              for (const [dom, sels] of Object.entries(customStore.byDomain)) {
                if (matchesDomainOrSubdomain(host, dom) && Array.isArray(sels)) {
                  customSelectors.push(...sels);
                }
              }
            }
          }

          const customProcedural = Array.isArray(customStore?.procedural)
            ? customStore.procedural
            : [];
          activeCustomSelectors = customSelectors;
          activeCustomProcedural = customProcedural;
          if (customSelectors.length > 0 || customProcedural.length > 0) {
            runCosmeticSweep(doc, activeCustomSelectors, activeCustomProcedural);
          }
        }
      );
    } catch {
      // Bỏ qua nếu storage chưa sẵn sàng
    }
  }

  // 9. Lắng nghe yêu cầu kích hoạt công cụ chọn phần tử (Element Zapper) từ popup
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    try {
      chrome.runtime.onMessage.addListener((msg: any) => {
        if (msg?.kind === 'START_ELEMENT_PICKER') {
          startElementPicker(doc, (selector) => {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
              chrome.storage.local.get(['user_blocked_selectors'], (res: { [key: string]: any }) => {
                const currentList: string[] = Array.isArray(res?.user_blocked_selectors) ? res.user_blocked_selectors : [];
                if (!currentList.includes(selector)) {
                  currentList.push(selector);
                  chrome.storage.local.set({ user_blocked_selectors: currentList });
                }
              });
            }
          });
        }
      });
    } catch {
      // Bỏ qua nếu môi trường test không có chrome.runtime
    }
  }

  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });

  return { cleanup, observer };
}
