// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { isIabBannerSize, scanAndHideHeuristicAds, IAB_SIZES } from '../../src/cosmetic/heuristicAdDetector';

describe('HeuristicAdDetector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('nhận diện chính xác toàn bộ các kích thước banner quảng cáo IAB', () => {
    for (const size of IAB_SIZES) {
      expect(isIabBannerSize(size.w, size.h)).toBe(true);
    }
  });

  it('chấp nhận dung sai kích thước +/- 5px cho banner thực tế', () => {
    expect(isIabBannerSize(302, 248)).toBe(true); // Gần 300x250
    expect(isIabBannerSize(725, 93)).toBe(true);  // Gần 728x90
    expect(isIabBannerSize(323, 52)).toBe(true);  // Gần 320x50
  });

  it('loại trừ các kích thước không phải quảng cáo (như trang truyện hay video)', () => {
    expect(isIabBannerSize(800, 1200)).toBe(false); // Ảnh trang truyện
    expect(isIabBannerSize(1920, 1080)).toBe(false); // Khung video Full HD
    expect(isIabBannerSize(50, 50)).toBe(false);    // Avatar / Icon
    expect(isIabBannerSize(0, 0)).toBe(false);
  });

  it('quét và ẩn thành công thẻ iframe quảng cáo có kích thước IAB', () => {
    const container = document.createElement('div');
    const iframe = document.createElement('iframe');
    
    // Giả lập kích thước bounding rect cho iframe
    iframe.getBoundingClientRect = () => ({
      width: 300,
      height: 250,
      top: 0,
      left: 0,
      right: 300,
      bottom: 250,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    container.appendChild(iframe);
    document.body.appendChild(container);

    const hiddenCount = scanAndHideHeuristicAds(document);
    expect(hiddenCount).toBe(1);
    expect(container.style.display).toBe('none');
    expect(container.style.height).toBe('0px');
  });

  it('không ẩn các iframe có kích thước thông thường (không phải banner quảng cáo)', () => {
    const iframe = document.createElement('iframe');
    iframe.getBoundingClientRect = () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    document.body.appendChild(iframe);

    const hiddenCount = scanAndHideHeuristicAds(document);
    expect(hiddenCount).toBe(0);
    expect(iframe.style.display).not.toBe('none');
  });
});