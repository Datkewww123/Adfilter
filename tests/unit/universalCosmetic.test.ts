// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { runCosmeticSweep, injectCosmeticStyle, initUniversalContent, BUILTIN_COSMETIC_RULES } from '../../src/content/universalEngine';
import type { CosmeticRule } from '../../src/cosmetic/cosmeticEngine';

describe('UniversalCosmeticIntegration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const oldStyle = document.getElementById('adfilter-cosmetic-styles');
    if (oldStyle) oldStyle.remove();
  });

  it('tiêm thành công thẻ style chứa quy tắc CSS ẩn quảng cáo vào document', () => {
    injectCosmeticStyle(document);
    const styleEl = document.getElementById('adfilter-cosmetic-styles');
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toContain('.ad-banner');
    expect(styleEl?.textContent).toContain('display: none !important;');
  });

  it('runCosmeticSweep quét sạch banner dính, co rút khung quảng cáo rỗng, gỡ modal và nạp ảnh lười', () => {
    // 1. Tạo một banner sticky chân trang
    const bottomAd = document.createElement('div');
    bottomAd.className = 'ad-banner';
    bottomAd.style.position = 'fixed';
    bottomAd.style.bottom = '0px';
    document.body.appendChild(bottomAd);

    // 2. Tạo một khung quảng cáo rỗng
    const emptySlot = document.createElement('div');
    emptySlot.className = 'ad-container';
    emptySlot.style.height = '250px';
    document.body.appendChild(emptySlot);

    // 3. Tạo một modal cảnh báo adblock
    const modal = document.createElement('div');
    modal.className = 'adblock-modal';
    document.body.appendChild(modal);

    // 4. Tạo một ảnh lười chưa nạp src
    const img = document.createElement('img');
    img.setAttribute('data-src', 'https://cdn.manga.org/ch1/p1.jpg');
    document.body.appendChild(img);

    // Thực thi quét dọn toàn diện
    runCosmeticSweep(document);

    // Xác minh kết quả
    expect(bottomAd.style.display).toBe('none');
    expect(emptySlot.style.display).toBe('none');
    expect(emptySlot.style.height).toBe('0px');
    expect(document.querySelector('.adblock-modal')).toBeNull();
    expect(img.src).toBe('https://cdn.manga.org/ch1/p1.jpg');
  });

  it('đảm bảo danh sách BUILTIN_COSMETIC_RULES đã được phân tích hợp lệ', () => {
    expect(BUILTIN_COSMETIC_RULES.length).toBeGreaterThan(5);
    const hasAdBanner = BUILTIN_COSMETIC_RULES.some((r: CosmeticRule) => r.selector === '.ad-banner');
    expect(hasAdBanner).toBe(true);
  });

  it('ngăn chặn tiêm style trùng lặp khi injectCosmeticStyle được gọi nhiều lần', () => {
    const first = injectCosmeticStyle(document);
    expect(first).not.toBeNull();
    const second = injectCosmeticStyle(document);
    expect(second).toBeNull();
    const allStyles = document.querySelectorAll('#adfilter-cosmetic-styles');
    expect(allStyles.length).toBe(1);
  });

  it('cơ chế cleanup ngắt kết nối MutationObserver để chống rò rỉ bộ nhớ (Memory Leak)', () => {
    const instance = initUniversalContent(document);
    expect(instance).not.toBeNull();
    expect(typeof instance?.cleanup).toBe('function');
    // Thực thi dọn dẹp
    instance?.cleanup();
  });

  it('bỏ qua can thiệp khi hostname nằm trong danh sách ngoại lệ (Per-Site Whitelist)', () => {
    // Giả lập hostname trong window.location
    const originalHost = window.location.hostname;
    try {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'trusted-bank.com' },
        configurable: true,
      });

      const instance = initUniversalContent(document, ['trusted-bank.com']);
      expect(instance).toBeNull();
      // Không có style nào được tiêm
      expect(document.getElementById('adfilter-cosmetic-styles')).toBeNull();
    } finally {
      Object.defineProperty(window, 'location', {
        value: { hostname: originalHost },
        configurable: true,
      });
    }
  });

  it('runCosmeticSweep ẩn triệt để các banner đặc thù web truyện Việt Nam (catfish, top banner, popup DEBET/SUNWIN)', () => {
    const topBanner = document.createElement('div');
    topBanner.id = 'top-banner-info-container';
    topBanner.innerHTML = '<a href="https://rikvipchinhhang.com/top"><img src="https://mplmncb.com/banners-web/rik.gif"></a>';
    document.body.appendChild(topBanner);

    const catfishBanner = document.createElement('div');
    catfishBanner.id = 'catfish-banner-info-container';
    catfishBanner.innerHTML = '<a href="https://sunwinchinhhang.com/catfish"><img src="https://mplmncb.com/banners-web/sun.gif"></a>';
    document.body.appendChild(catfishBanner);

    const debetModal = document.createElement('div');
    debetModal.id = 'popup-debet-modal';
    debetModal.innerHTML = '<a href="https://debet.com/promo"><img src="https://mplmncb.com/banners-web/debet.gif"></a>';
    document.body.appendChild(debetModal);

    runCosmeticSweep(document);

    expect(topBanner.style.display).toBe('none');
    expect(catfishBanner.style.display).toBe('none');
    expect(debetModal.style.display).toBe('none');
  });
});
