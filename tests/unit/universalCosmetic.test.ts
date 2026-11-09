// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { runCosmeticSweep, injectCosmeticStyle, BUILTIN_COSMETIC_RULES } from '../../src/content/universalContent';
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

  it('runCosmeticSweep quét sạch banner dính và co rút khung quảng cáo rỗng trên trang truyện', () => {
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

    // Thực thi quét dọn
    runCosmeticSweep(document);

    // Xác minh kết quả
    expect(bottomAd.style.display).toBe('none');
    expect(emptySlot.style.display).toBe('none');
    expect(emptySlot.style.height).toBe('0px');
  });

  it('đảm bảo danh sách BUILTIN_COSMETIC_RULES đã được phân tích hợp lệ', () => {
    expect(BUILTIN_COSMETIC_RULES.length).toBeGreaterThan(5);
    const hasAdBanner = BUILTIN_COSMETIC_RULES.some((r: CosmeticRule) => r.selector === '.ad-banner');
    expect(hasAdBanner).toBe(true);
  });
});
