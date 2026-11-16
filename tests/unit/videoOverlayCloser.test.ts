// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { autoCloseMovieOverlays, purgeMoviePlayerAdOverlays } from '../../src/core/videoOverlayCloser';

describe('VideoOverlayCloser (Tự động đóng quảng cáo video trên web phim)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('tự động click vào các nút đóng quảng cáo video dạng JWPlayer / VideoJS', () => {
    const btn1 = document.createElement('button');
    btn1.className = 'jw-ad-close';
    const clickSpy1 = vi.fn();
    btn1.addEventListener('click', clickSpy1);
    document.body.appendChild(btn1);

    const btn2 = document.createElement('div');
    btn2.className = 'close-ad-button';
    const clickSpy2 = vi.fn();
    btn2.addEventListener('click', clickSpy2);
    document.body.appendChild(btn2);

    const btn3 = document.createElement('span');
    btn3.setAttribute('aria-label', 'Close Ad');
    const clickSpy3 = vi.fn();
    btn3.addEventListener('click', clickSpy3);
    document.body.appendChild(btn3);

    const count = autoCloseMovieOverlays(document);
    expect(count).toBe(3);
    expect(clickSpy1).toHaveBeenCalledTimes(1);
    expect(clickSpy2).toHaveBeenCalledTimes(1);
    expect(clickSpy3).toHaveBeenCalledTimes(1);
  });

  it('ẩn triệt để các overlay quảng cáo đè lên video player', () => {
    const overlay1 = document.createElement('div');
    overlay1.className = 'jw-ad-ui';
    document.body.appendChild(overlay1);

    const overlay2 = document.createElement('div');
    overlay2.className = 'video-ad-overlay';
    document.body.appendChild(overlay2);

    const count = purgeMoviePlayerAdOverlays(document);
    expect(count).toBe(2);
    expect(overlay1.style.display).toBe('none');
    expect(overlay2.style.display).toBe('none');
  });

  it('ẩn triệt để Pause-Ad custom kiểu AnimeVietsub (BOM88 / Quảng cáo / Đóng và xem tiếp) mà giữ nguyên thẻ video', () => {
    const playerWrap = document.createElement('div');
    playerWrap.className = 'anime-player-box';

    const video = document.createElement('video');
    playerWrap.appendChild(video);

    const pauseModal = document.createElement('div');
    pauseModal.id = 'pause-bom88-box';
    pauseModal.innerHTML = `
      <a href="https://bom88.win/promo"><img src="bom88.gif" alt="BOM88" /></a>
      <div>Quảng cáo</div>
      <button type="button">Đóng quảng cáo</button>
      <button type="button">Đóng và xem tiếp</button>
    `;
    playerWrap.appendChild(pauseModal);
    document.body.appendChild(playerWrap);

    const hiddenCount = purgeMoviePlayerAdOverlays(document);
    expect(hiddenCount).toBeGreaterThanOrEqual(1);
    expect(pauseModal.style.display).toBe('none');
    expect(video.style.display).not.toBe('none');
    expect(playerWrap.style.display).not.toBe('none');
  });
});
