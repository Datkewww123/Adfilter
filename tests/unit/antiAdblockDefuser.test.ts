// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { installAntiAdblockDefuser } from '../../src/stealth/antiAdblockDefuser';

describe('AntiAdblockDefuser', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('định nghĩa thành công các cờ canRunAds và isAdBlockActive', () => {
    installAntiAdblockDefuser(window);
    expect((window as any).canRunAds).toBe(true);
    expect((window as any).isAdBlockActive).toBe(false);
  });

  it('trả về chiều cao và chiều rộng giả lập cho các thẻ mồi adsbox', () => {
    installAntiAdblockDefuser(window);

    const bait = document.createElement('div');
    bait.className = 'adsbox pub_300x250';
    document.body.appendChild(bait);

    // Dù chưa có nội dung thật, offsetHeight và offsetWidth vẫn trả về kích thước giả lập
    expect(bait.offsetHeight).toBe(100);
    expect(bait.offsetWidth).toBe(300);
  });

  it('trả về kích thước bình thường cho các thẻ không phải mồi quảng cáo', () => {
    installAntiAdblockDefuser(window);

    const normalDiv = document.createElement('div');
    normalDiv.className = 'chapter-content';
    document.body.appendChild(normalDiv);

    // Thẻ thông thường không bị can thiệp
    expect(normalDiv.offsetHeight).toBe(0);
  });
});
