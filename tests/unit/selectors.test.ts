// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  getSkipButton,
  SELECTORS_DESKTOP,
  SELECTORS_MOBILE,
  selectorsFor,
} from '../../src/content/selectors';

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
  it('nhận diện nút Skip bên trong .ytp-ad-module > .ytp-ad-player-overlay-layout khi có layout box và bỏ qua khi display: none hoặc đang đếm ngược', () => {
    document.body.innerHTML = `
      <div id="movie_player" class="ad-showing">
        <div class="ytp-ad-module" style="opacity: 0; pointer-events: none;">
          <div class="ytp-ad-player-overlay-layout">
            <button class="ytp-skip-ad-button">Skip</button>
          </div>
        </div>
      </div>
    `;
    const btn = document.querySelector<HTMLElement>('.ytp-skip-ad-button')!;
    Object.defineProperty(btn, 'offsetWidth', { value: 80, configurable: true });
    expect(getSkipButton(document)).toBe(btn);

    // Đang đếm ngược chỉ có số -> bỏ qua
    btn.textContent = '5';
    expect(getSkipButton(document)).toBeNull();

    // Đã hiện chữ Bỏ qua nhưng bị ẩn inline display: none -> bỏ qua
    btn.textContent = 'Bỏ qua';
    btn.style.display = 'none';
    expect(getSkipButton(document)).toBeNull();

    // Khi YouTube mở khóa nút -> nhận diện ngay lập tức để diệt cả cụm QC
    btn.style.display = '';
    expect(getSkipButton(document)).toBe(btn);
  });
});