// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveLazyImages, startLazyLoadProtector } from '../../src/core/lazyLoadProtector';

describe('LazyLoadProtector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('tự động gán thuộc tính data-src vào src khi ảnh chưa nạp', () => {
    const img = document.createElement('img');
    img.setAttribute('data-src', 'https://manga-cdn.org/chapter1/page1.jpg');
    document.body.appendChild(img);

    const count = resolveLazyImages(document);
    expect(count).toBe(1);
    expect(img.src).toBe('https://manga-cdn.org/chapter1/page1.jpg');
  });

  it('hỗ trợ data-original và data-lazy-src', () => {
    const img1 = document.createElement('img');
    img1.setAttribute('data-original', 'https://manga.org/p2.jpg');
    document.body.appendChild(img1);

    const img2 = document.createElement('img');
    img2.setAttribute('data-lazy-src', 'https://manga.org/p3.jpg');
    document.body.appendChild(img2);

    const count = resolveLazyImages(document);
    expect(count).toBe(2);
    expect(img1.src).toBe('https://manga.org/p2.jpg');
    expect(img2.src).toBe('https://manga.org/p3.jpg');
  });

  it('bảo vệ ảnh qua MutationObserver khi cuộn hoặc tải thêm chương mới', async () => {
    const cleanup = startLazyLoadProtector(document);

    const newImg = document.createElement('img');
    newImg.setAttribute('data-src', 'https://manga.org/p4.jpg');
    document.body.appendChild(newImg);

    // Chờ MutationObserver kích hoạt debounce
    await new Promise((r) => setTimeout(r, 200));

    expect(newImg.src).toBe('https://manga.org/p4.jpg');
    cleanup();
  });
});
