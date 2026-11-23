// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { getSkipButton, SELECTORS_DESKTOP, SELECTORS_MOBILE, selectorsFor } from '../../src/content/selectors';

describe('selectorsFor', () => {
  it('m.youtube.com dùng bộ di động', () => {
    expect(selectorsFor('m.youtube.com')).toBe(SELECTORS_MOBILE);
  });

  it.each(['www.youtube.com', 'localhost', ''])('%j dùng bộ máy tính', (host) => {
    expect(selectorsFor(host)).toBe(SELECTORS_DESKTOP);
  });

  it.each([SELECTORS_DESKTOP, SELECTORS_MOBILE])('không có selector rỗng', (set) => {
    for (const value of Object.values(set)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('getSkipButton', () => {
  it('tìm thấy nút Skip bên trong .ytp-ad-module > .ytp-ad-player-overlay-layout khi đang ẩn bằng opacity/visibility', () => {
    document.body.innerHTML = `
      <div id="movie_player" class="html5-video-player ad-showing">
        <div class="ytp-ad-module" style="opacity: 0; visibility: hidden;">
          <div class="ytp-ad-player-overlay-layout" style="opacity: 0; visibility: hidden;">
            <div class="ytp-ad-skip-button-slot">
              <button class="ytp-skip-ad-button" style="width: 80px; height: 32px;">Bỏ qua</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const btn = getSkipButton(document);
    expect(btn).not.toBeNull();
    expect(btn?.classList.contains('ytp-skip-ad-button')).toBe(true);
  });

  it('trả về null khi .ytp-ad-skip-button-slot đang display: none lúc đếm ngược', () => {
    document.body.innerHTML = `
      <div id="movie_player" class="html5-video-player ad-showing">
        <div class="ytp-ad-module">
          <div class="ytp-ad-player-overlay-layout">
            <div class="ytp-ad-skip-button-slot" style="display: none;">
              <button class="ytp-skip-ad-button" style="width: 80px; height: 32px;">Skip</button>
            </div>
          </div>
        </div>
      </div>
    `;
    expect(getSkipButton(document)).toBeNull();
  });
});