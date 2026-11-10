// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveLazyImages,
  startLazyLoadProtector,
  sanitizeImageUrl,
  sanitizeImageSrcset,
} from '../../src/core/lazyLoadProtector';

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

  it('từ chối và không gán các URL nguy hiểm (DOM XSS / CodeQL alert)', () => {
    const maliciousImg1 = document.createElement('img');
    maliciousImg1.setAttribute('data-src', 'javascript:alert("XSS")');
    document.body.appendChild(maliciousImg1);

    const maliciousImg2 = document.createElement('img');
    maliciousImg2.setAttribute('data-original', 'data:text/html,<script>alert(1)</script>');
    document.body.appendChild(maliciousImg2);

    const count = resolveLazyImages(document);
    expect(count).toBe(0);
    expect(maliciousImg1.src).toBe('');
    expect(maliciousImg2.src).toBe('');
  });

  it('hỗ trợ ảnh hợp lệ data:image và data-srcset an toàn', () => {
    const validDataImg = document.createElement('img');
    const validDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    validDataImg.setAttribute('data-src', validDataUri);
    validDataImg.setAttribute('data-srcset', 'https://manga.org/p1-2x.jpg 2x, https://manga.org/p1-1x.jpg 1x');
    document.body.appendChild(validDataImg);

    const count = resolveLazyImages(document);
    expect(count).toBe(1);
    expect(validDataImg.src).toBe(validDataUri);
    expect(validDataImg.srcset).toBe('https://manga.org/p1-2x.jpg 2x, https://manga.org/p1-1x.jpg 1x');
  });

  it('kiểm thử trực tiếp hàm sanitizeImageUrl và sanitizeImageSrcset', () => {
    expect(sanitizeImageUrl('javascript:evil()')).toBeNull();
    expect(sanitizeImageUrl('vbscript:msgbox(1)')).toBeNull();
    expect(sanitizeImageUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBeNull();
    expect(sanitizeImageUrl('https://cdn.example.com/pic.jpg')).toBe('https://cdn.example.com/pic.jpg');
    expect(sanitizeImageUrl('http://cdn.example.com/pic.jpg')).toBe('http://cdn.example.com/pic.jpg');

    const cleanSrcset = sanitizeImageSrcset('https://cdn.com/a.jpg 1x, javascript:evil() 2x, https://cdn.com/b.jpg 2x');
    expect(cleanSrcset).toBe('https://cdn.com/a.jpg 1x, https://cdn.com/b.jpg 2x');
  });
});
