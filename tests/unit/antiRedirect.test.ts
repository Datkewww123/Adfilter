import { describe, it, expect, vi } from 'vitest';
import { isSuspiciousUrl } from '../../src/stealth/antiPopup';
import { installAntiRedirect, isSameOriginUrl } from '../../src/stealth/antiRedirect';

describe('AntiRedirect', () => {
  it('từ chối chuyển hướng tới domain cờ bạc / quảng cáo độc hại', () => {
    const badUrl = 'https://adclick.megaredirect.com/traffic';
    expect(isSuspiciousUrl(badUrl)).toBe(true);
  });

  it('chấp nhận chuyển hướng trang đọc chương truyện bình thường', () => {
    const goodUrl = 'https://nettruyen.com/chapter-2';
    expect(isSuspiciousUrl(goodUrl)).toBe(false);
  });

  it('cho phép chuyển hướng cùng tên miền (ví dụ sau xác thực Cloudflare) ngay cả khi không có click và vẫn chặn redirect cross-origin ngầm', () => {
    const origAssign = vi.fn();
    const origReplace = vi.fn();
    const fakeWin = {
      location: {
        origin: 'https://dtv-ebook.com.vn',
        href: 'https://dtv-ebook.com.vn/van-co.html',
        assign: origAssign,
        replace: origReplace,
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      document: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    } as unknown as Window;

    expect(isSameOriginUrl('https://dtv-ebook.com.vn/van-co.html?__cf_chl_tk=1', fakeWin)).toBe(true);
    expect(isSameOriginUrl('/chuong-2.html', fakeWin)).toBe(true);
    expect(isSameOriginUrl('https://ad-redirect.example/offer', fakeWin)).toBe(false);

    const restore = installAntiRedirect(fakeWin);

    fakeWin.location.replace('https://dtv-ebook.com.vn/van-co.html?verified=1');
    expect(origReplace).toHaveBeenCalledTimes(1);

    fakeWin.location.assign('/doc-truyen');
    expect(origAssign).toHaveBeenCalledTimes(1);

    fakeWin.location.replace('https://evil-popunder.example/promo');
    expect(origReplace).toHaveBeenCalledTimes(1);

    fakeWin.location.replace('https://adclick.megaredirect.com/traffic');
    expect(origReplace).toHaveBeenCalledTimes(1);

    // Chuyển hướng cross-origin hợp lệ như OAuth / SSO trên ChatGPT được phép khi không phải click vào player video
    fakeWin.location.assign(
      'https://auth.openai.com/authorize?client_id=abc&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fapi%2Fauth%2Fcallback',
    );
    expect(origAssign).toHaveBeenCalledTimes(2);

    restore();
    expect(fakeWin.location.assign).toBe(origAssign);
    expect(fakeWin.location.replace).toBe(origReplace);
  });
});
