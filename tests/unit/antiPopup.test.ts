import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installAntiPopup, isSuspiciousUrl } from '../../src/stealth/antiPopup';

describe('AntiPopup Engine', () => {
  let fakeWindow: any;
  let originalOpenMock: any;

  beforeEach(() => {
    originalOpenMock = vi.fn().mockReturnValue({});
    fakeWindow = {
      open: originalOpenMock,
      addEventListener: vi.fn(),
    };
  });

  it('nhận diện chính xác URL quảng cáo / cờ bạc đáng ngờ', () => {
    expect(isSuspiciousUrl('https://shopee.vn/universal-link')).toBe(true);
    expect(isSuspiciousUrl('https://kubet88.net/casino')).toBe(true);
    expect(isSuspiciousUrl('https://big88.services/?utm_source=clickadu&utm_medium=popunder_123')).toBe(true);
    expect(isSuspiciousUrl('https://sunwinchinhhang.com/truyenqq')).toBe(true);
    expect(isSuspiciousUrl('https://gemwinchinhhang.com/promo')).toBe(true);
    expect(isSuspiciousUrl('https://debet.com/login')).toBe(true);
    expect(isSuspiciousUrl('https://five88.com/')).toBe(true);
    expect(isSuspiciousUrl('https://red88.com/')).toBe(true);
    expect(isSuspiciousUrl('https://nettruyen.com/chap-1')).toBe(false);
    expect(isSuspiciousUrl('')).toBe(false);
  });

  it('chặn window.open khi không có tương tác người dùng gần nhất', () => {
    const onBlocked = vi.fn();
    installAntiPopup(fakeWindow, { onBlocked });

    const result = fakeWindow.open('https://example.com/popup', '_blank');

    expect(result).toBeNull();
    expect(originalOpenMock).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledWith('https://example.com/popup');
  });

  it('chặn window.open tới trang cá cược / popunder ngay cả ngay sau khi người dùng vừa click', () => {
    let pointerDownCb: (() => void) | undefined;
    fakeWindow.addEventListener = vi.fn((event: string, cb: () => void) => {
      if (event === 'pointerdown') {
        pointerDownCb = cb;
      }
    });

    const onBlocked = vi.fn();
    installAntiPopup(fakeWindow, { onBlocked });

    // Giả lập người dùng vừa click chuột vào link chương truyện
    pointerDownCb?.();

    const popunderUrl =
      'https://big88.services/?a=8df17168&utm_source=clickadu&utm_medium=popunder_2117581';
    const result = fakeWindow.open(popunderUrl, '_blank');

    expect(result).toBeNull();
    expect(originalOpenMock).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledWith(popunderUrl);

    // Nhưng cho phép link hợp lệ do người dùng mở
    fakeWindow.open('https://truyenqqto.com/chap-2', '_blank');
    expect(originalOpenMock).toHaveBeenCalledTimes(1);
  });
});