// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isCoveringScreen, installClickHijackGuard } from '../../src/core/clickHijackGuard';

describe('ClickHijackGuard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.innerWidth = 1000;
    window.innerHeight = 800;
  });

  it('nhận diện chính xác div tàng hình phủ toàn màn hình có z-index cực cao', () => {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.zIndex = '999999';
    div.style.opacity = '0';
    div.getBoundingClientRect = () => ({ width: 1000, height: 800 } as any);
    document.body.appendChild(div);

    expect(isCoveringScreen(div, window)).toBe(true);
  });

  it('không nhận diện nhầm nội dung trang web thông thường', () => {
    const content = document.createElement('div');
    content.style.position = 'relative';
    content.style.zIndex = '1';
    content.style.opacity = '1';
    content.getBoundingClientRect = () => ({ width: 800, height: 600 } as any);
    document.body.appendChild(content);

    expect(isCoveringScreen(content, window)).toBe(false);
  });

  it('chặn sự kiện click và tự động xóa thẻ div tàng hình', () => {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.zIndex = '999999';
    div.style.opacity = '0';
    div.getBoundingClientRect = () => ({ width: 1000, height: 800 } as any);
    document.body.appendChild(div);

    const onNeutralized = vi.fn();
    installClickHijackGuard(document, { onNeutralized });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    div.dispatchEvent(event);

    expect(onNeutralized).toHaveBeenCalledWith(div);
    expect(div.parentElement).toBeNull();
  });

  it('bắt lớp phủ click-catcher trong suốt (background transparent) đè lên video player', () => {
    const player = document.createElement('div');
    player.className = 'jwplayer';
    const video = document.createElement('video');
    video.getBoundingClientRect = () => ({ width: 640, height: 360 } as DOMRect);
    const trapOverlay = document.createElement('div');
    trapOverlay.style.position = 'absolute';
    trapOverlay.style.zIndex = '50';
    trapOverlay.style.backgroundColor = 'transparent';
    trapOverlay.getBoundingClientRect = () => ({ width: 640, height: 360 } as DOMRect);

    player.appendChild(video);
    player.appendChild(trapOverlay);
    document.body.appendChild(player);

    expect(isCoveringScreen(trapOverlay, window)).toBe(true);
  });
});