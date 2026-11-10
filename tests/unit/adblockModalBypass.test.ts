// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { bypassAdblockModals } from '../../src/core/adblockModalBypass';

describe('AdblockModalBypass', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    document.body.style.filter = '';
    document.documentElement.style.overflow = '';
  });

  it('xóa sạch các modal và overlay cảnh báo adblock khỏi DOM', () => {
    const modal = document.createElement('div');
    modal.className = 'adblock-modal';
    modal.innerHTML = '<p>Vui lòng tắt trình chặn quảng cáo để đọc truyện</p>';
    document.body.appendChild(modal);

    const backdrop = document.createElement('div');
    backdrop.id = 'adblock-overlay';
    document.body.appendChild(backdrop);

    const count = bypassAdblockModals(document);
    expect(count).toBe(2);
    expect(document.querySelector('.adblock-modal')).toBeNull();
    expect(document.querySelector('#adblock-overlay')).toBeNull();
  });

  it('xóa bỏ hiệu ứng làm mờ filter blur và class khóa cuộn trên body', () => {
    document.body.className = 'modal-open blur-backdrop';
    document.body.style.filter = 'blur(5px)';
    document.documentElement.style.overflow = 'hidden';

    bypassAdblockModals(document);

    expect(document.body.style.filter).toBe('none');
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(document.body.classList.contains('blur-backdrop')).toBe(false);
    expect(document.documentElement.style.overflow).toBe('auto');
  });

  it('khôi phục pointer-events: auto khi website cố tình khóa click', () => {
    document.body.style.pointerEvents = 'none';
    bypassAdblockModals(document);
    expect(document.body.style.pointerEvents).toBe('auto');
  });
});
