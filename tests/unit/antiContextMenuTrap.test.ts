// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { unlockContextMenu } from '../../src/stealth/antiContextMenuTrap';

describe('AntiContextMenuTrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('ngăn chặn sự kiện contextmenu bị website hủy bỏ', () => {
    const cleanup = unlockContextMenu(window);

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

    window.dispatchEvent(event);

    expect(stopPropagationSpy).toHaveBeenCalled();
    cleanup();
  });

  it('ngăn chặn sự kiện copy bị website chặn', () => {
    const cleanup = unlockContextMenu(window);

    const event = new Event('copy', { bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

    window.dispatchEvent(event);

    expect(stopPropagationSpy).toHaveBeenCalled();
    cleanup();
  });

  it('khôi phục user-select: auto cho document', () => {
    document.body.style.userSelect = 'none';
    unlockContextMenu(window);
    expect(document.body.style.userSelect).toBe('auto');
  });
});
