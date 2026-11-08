 import { describe, it, expect } from 'vitest';
import { isSuspiciousUrl } from '../../src/stealth/antiPopup';

describe('AntiRedirect', () => {
  it('từ chối chuyển hướng tới domain cờ bạc / quảng cáo độc hại', () => {
    const badUrl = 'https://adclick.megaredirect.com/traffic';
    expect(isSuspiciousUrl(badUrl)).toBe(true);
  });

  it('chấp nhận chuyển hướng trang đọc chương truyện bình thường', () => {
    const goodUrl = 'https://nettruyen.com/chapter-2';
    expect(isSuspiciousUrl(goodUrl)).toBe(false);
  });
});