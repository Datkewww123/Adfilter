const DANGEROUS_PROTOCOL_REGEX = /^(?:javascript|vbscript|data(?!\s*:\s*image\/)):/i;
const SAFE_IMAGE_DATA_REGEX = /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml|avif|bmp|ico);base64,[a-z0-9+/=\s]+$/i;

/**
 * Kiểm tra và làm sạch URL ảnh để ngăn chặn DOM-based XSS (CodeQL js/xss-through-dom).
 * Chỉ chấp nhận các đường dẫn ảnh an toàn: http, https hoặc data:image chuyên dụng.
 */
export function sanitizeImageUrl(rawUrl: string | null | undefined, baseUri?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || DANGEROUS_PROTOCOL_REGEX.test(trimmed)) return null;

  // Chặn đứng bất kỳ payload chứa thẻ script hoặc sự kiện nguy hiểm
  const lower = trimmed.toLowerCase();
  if (lower.includes('<script') || lower.includes('onerror=') || lower.includes('onload=')) {
    return null;
  }

  // Chấp nhận chuỗi base64 data:image hợp lệ
  if (SAFE_IMAGE_DATA_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    const base = baseUri && !baseUri.startsWith('about:') ? baseUri : 'https://example.com';
    const parsed = new URL(trimmed, base);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Làm sạch chuỗi srcset để loại bỏ bất kỳ URL nào không an toàn
 */
export function sanitizeImageSrcset(rawSrcset: string | null | undefined, baseUri?: string): string | null {
  if (!rawSrcset || typeof rawSrcset !== 'string') return null;
  const candidates = rawSrcset.split(',').map((c) => c.trim()).filter(Boolean);
  const safeCandidates: string[] = [];

  for (const candidate of candidates) {
    const parts = candidate.split(/\s+/);
    const url = parts[0];
    const descriptor = parts[1] || '';
    const safeUrl = sanitizeImageUrl(url, baseUri);
    if (safeUrl) {
      safeCandidates.push(descriptor ? `${safeUrl} ${descriptor}` : safeUrl);
    }
  }

  return safeCandidates.length > 0 ? safeCandidates.join(', ') : null;
}

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
      const safeSrc = sanitizeImageUrl(realSrc, doc.baseURI);
      if (safeSrc) {
        img.src = safeSrc;
        count++;
      }
    }

    const realSrcset = img.getAttribute('data-srcset');
    if (realSrcset && !img.srcset) {
      const safeSrcset = sanitizeImageSrcset(realSrcset, doc.baseURI);
      if (safeSrcset) {
        img.srcset = safeSrcset;
      }
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
