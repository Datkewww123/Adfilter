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
});