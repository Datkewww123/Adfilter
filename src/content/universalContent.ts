import { installClickHijackGuard } from '../core/clickHijackGuard';
import { parseCosmeticRule, generateInjectedCss, type CosmeticRule } from '../cosmetic/cosmeticEngine';
import { scanAndHideHeuristicAds } from '../cosmetic/heuristicAdDetector';
import { purgeFloatingAds } from '../cosmetic/floatingBannerGuard';
import { collapseEmptyAdSlots } from '../cosmetic/elementCollapsing';
import { bypassAdblockModals } from '../core/adblockModalBypass';
import { resolveLazyImages, startLazyLoadProtector } from '../core/lazyLoadProtector';
import { autoCloseMovieOverlays, purgeMoviePlayerAdOverlays } from '../core/videoOverlayCloser';
import { isDomainWhitelisted } from '../core/siteWhitelist';

// Danh sách các quy tắc CSS ẩn quảng cáo phổ biến trên web đọc truyện & web phim
export const COMMON_COSMETIC_RULES_RAW = [
  '##.ad-banner',
  '##.banner-ads',
  '##.adsbox',
  '##.ads-holder',
  '##.ad-container',
  '##.ad-wrapper',
  '##[id^="ad_"]',
  '##[id^="ads_"]',
  '##[class*="ad-slot"]',
  '##.floating-banner',
  '##.qc-sticky',
  '##.qc-left-side',
  '##.qc-right-side',
];

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

  const css = generateInjectedCss(BUILTIN_COSMETIC_RULES, window.location.hostname);
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
 * Thực hiện một lượt quét dọn toàn diện: Heuristic IAB Ads + Floating Ads + Element Collapsing + Anti-Adblock Modal + Lazy Images + Movie Video Overlays
 */
export function runCosmeticSweep(doc: Document = document): void {
  scanAndHideHeuristicAds(doc);
  purgeFloatingAds(doc);
  collapseEmptyAdSlots(doc);
  bypassAdblockModals(doc);
  resolveLazyImages(doc);
  autoCloseMovieOverlays(doc);
  purgeMoviePlayerAdOverlays(doc);
}

/**
 * Khởi động toàn bộ Universal Content Engine
 */
export function initUniversalContent(
  doc: Document = document,
  whitelist: string[] = []
): { cleanup: () => void; observer: MutationObserver } | null {
  const host = window.location.hostname;
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
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

  // 3. Quét dọn ban đầu
  runCosmeticSweep(doc);

  // 4. Lắng nghe sự kiện DOMContentLoaded và Window load
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', () => runCosmeticSweep(doc), { once: true });
  }
  window.addEventListener('load', () => runCosmeticSweep(doc), { once: true });

  // 5. Khởi động bộ bảo vệ tải ảnh lười cho truyện tranh
  const stopLazyLoad = startLazyLoadProtector(doc);

  // 6. Thiết lập MutationObserver để bắt kịp các quảng cáo nạp ngầm (lazy-load) khi đọc truyện
  let sweepTimer: any = null;
  const observer = new MutationObserver(() => {
    if (sweepTimer) return;
    sweepTimer = setTimeout(() => {
      sweepTimer = null;
      runCosmeticSweep(doc);
    }, 200);
  });

  const targetNode = doc.body || doc.documentElement;
  if (targetNode) {
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });
  }

  // 7. Cơ chế dọn dẹp chống rò rỉ bộ nhớ (Memory Leak Protection) khi người dùng đổi trang / đọc chapter mới
  const cleanup = () => {
    if (sweepTimer) {
      clearTimeout(sweepTimer);
      sweepTimer = null;
    }
    observer.disconnect();
    stopLazyLoad();
    const styleEl = doc.getElementById('adfilter-cosmetic-styles');
    if (styleEl) styleEl.remove();
  };

  // 8. Đồng bộ với chrome.storage.local nếu có whitelist được cập nhật ngầm
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      chrome.storage.local.get(['whitelist_domains'], (data: { [key: string]: any }) => {
        const stored: string[] = Array.isArray(data?.whitelist_domains) ? data.whitelist_domains : [];
        if (isDomainWhitelisted(host, stored)) {
          cleanup();
        }
      });
    } catch {
      // Bỏ qua nếu storage chưa sẵn sàng
    }
  }

  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });

  return { cleanup, observer };
}

// Tự động kích hoạt khi nạp content script
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initUniversalContent(document);
}
