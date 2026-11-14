import { describe, it, expect } from 'vitest';
import {
  parseCosmeticRule,
  generateInjectedCss,
  collectCosmeticSelectorsForHost,
  generateCosmeticCssFromIndex,
  type CosmeticIndex,
} from '../../src/cosmetic/cosmeticEngine';

describe('CosmeticFilterEngine', () => {
  it('phân tích chính xác quy tắc toàn cục và theo domain', () => {
    // 1. Quy tắc toàn cục (bắt đầu bằng ##)
    const globalRule = parseCosmeticRule('##.banner-ads');
    expect(globalRule).toEqual({ domain: undefined, selector: '.banner-ads' });

    // 2. Quy tắc áp dụng cho domain cụ thể
    const domainRule = parseCosmeticRule('nettruyen.com##div[id^="ad_"]');
    expect(domainRule).toEqual({ domain: 'nettruyen.com', selector: 'div[id^="ad_"]' });

    // 3. Bỏ qua các dòng comment và metadata
    expect(parseCosmeticRule('! Đây là bình luận')).toBeNull();
    expect(parseCosmeticRule('[Adblock Plus 2.0]')).toBeNull();
    expect(parseCosmeticRule('')).toBeNull();
    expect(parseCosmeticRule('không_có_dấu_phân_cách')).toBeNull();
  });

  it('tạo CSS hợp lệ để tiêm vào DOM khớp với từng trang', () => {
    const rules = [
      { domain: undefined, selector: '.global-ad' },
      { domain: 'nettruyen.com', selector: '#top-banner' },
      { domain: 'other.com', selector: '#sidebar-ad' },
    ];

    const css = generateInjectedCss(rules, 'nettruyen.com');
    expect(css).toContain('.global-ad');
    expect(css).toContain('#top-banner');
    expect(css).not.toContain('#sidebar-ad');
    expect(css).toContain('display: none !important;');
    expect(css).toContain('height: 0 !important;');
  });

  it('hỗ trợ subdomain khớp với domain cha', () => {
    const rules = [{ domain: 'truyenfull.vn', selector: '.ads-holder' }];
    const css = generateInjectedCss(rules, 'm.truyenfull.vn');
    expect(css).toContain('.ads-holder');
  });

  it('trả về chuỗi rỗng nếu không có quy tắc nào khớp', () => {
    const rules = [{ domain: 'example.com', selector: '.ads' }];
    const css = generateInjectedCss(rules, 'nettruyen.com');
    expect(css).toBe('');
  });

  it('thu thập selector từ cosmetic_index theo domain/subdomain, xử lý ngoại lệ #@# và bỏ qua YouTube', () => {
    const index: CosmeticIndex = {
      version: 1,
      generic: ['.adsbygoogle', '.generic-banner'],
      byDomain: {
        'truyenqqko.com': ['[data-zone]', 'div.w-overlay'],
      },
      exceptionsByDomain: {
        'safe.example.com': ['.generic-banner'],
      },
      procedural: [],
    };

    const qqSelectors = collectCosmeticSelectorsForHost(index, 'm.truyenqqko.com');
    expect(qqSelectors).toContain('.adsbygoogle');
    expect(qqSelectors).toContain('[data-zone]');

    const safeCss = generateCosmeticCssFromIndex(index, 'safe.example.com');
    expect(safeCss).toContain('.adsbygoogle');
    expect(safeCss).not.toContain('.generic-banner');

    expect(collectCosmeticSelectorsForHost(index, 'www.youtube.com')).toEqual([]);
    expect(generateCosmeticCssFromIndex(index, 'youtube.com')).toBe('');
  });
});