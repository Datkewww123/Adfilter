/**
 * Bảo vệ cơ chế tải ảnh lười (Lazy-load) trên các website đọc truyện tranh,
 * đảm bảo ảnh các trang truyện không bị vỡ hoặc bị kẹt khi các thư viện script bên ngoài bị chặn.
 */
export function resolveLazyImages(doc: Document = document): number {
  let count = 0;
  const lazySelectors = 'img[data-src], img[data-original], img[data-lazy-src], img[data-url], img[data-srcset]';
  const images = doc.querySelectorAll<HTMLImageElement>(lazySelectors);

  images.forEach((img) => {
    const realSrc =
      img.getAttribute('data-src') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-lazy-src') ||
      img.getAttribute('data-url');

    if (realSrc && (!img.src || img.src.includes('data:image') || img.src.endsWith('placeholder.gif') || img.src.endsWith('loading.gif') || !img.complete)) {
      img.src = realSrc;
      count++;
    }

    const realSrcset = img.getAttribute('data-srcset');
    if (realSrcset && !img.srcset) {
      img.srcset = realSrcset;
    }
  });

  return count;
}

/**
 * Khởi động người bảo vệ ảnh lười: quét ngay lập tức và theo dõi khi cuộn trang
 */
export function startLazyLoadProtector(doc: Document = document): () => void {
  resolveLazyImages(doc);

  let timer: any = null;
  const scheduleResolve = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      resolveLazyImages(doc);
    }, 150);
  };

  const observer = new MutationObserver(scheduleResolve);
  const target = doc.body || doc.documentElement;
  if (target) {
    observer.observe(target, { childList: true, subtree: true });
  }

  const win = doc.defaultView || window;
  win.addEventListener('scroll', scheduleResolve, { passive: true });

  return () => {
    if (timer) clearTimeout(timer);
    observer.disconnect();
    win.removeEventListener('scroll', scheduleResolve);
  };
}
