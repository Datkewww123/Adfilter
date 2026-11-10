const EMPTY_VAST_XML = '<?xml version="1.0" encoding="UTF-8"?><VAST version="3.0"></VAST>';

const VAST_URL_PATTERN = /(?:vast|vpaid|\/ads?\/|adserver|imasdk\.googleapis\.com|doubleclick\.net|serving-sys\.com|ad-delivery)/i;
const MEDIA_STREAM_PATTERN = /\.(?:m3u8|mp4|ts|m4s|mpd|webm|mkv|aac|mp3)(?:\?|$)/i;

/**
 * Kiểm tra xem một URL có phải là yêu cầu quảng cáo video (VAST/VPAID) hay không.
 * Bảo vệ tuyệt đối không chặn nhầm file stream phim (.m3u8, .mp4, .ts...) hoặc YouTube.
 */
export function isVastAdUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.includes('youtube.com') || url.includes('googlevideo.com')) {
    return false;
  }
  if (MEDIA_STREAM_PATTERN.test(url)) {
    return false;
  }
  return VAST_URL_PATTERN.test(url);
}

/**
 * Làm sạch chuỗi XML quảng cáo VAST, trả về XML VAST rỗng không có quảng cáo
 * để các player như JWPlayer, Video.js bỏ qua quảng cáo đệm và phát phim ngay lập tức.
 */
export function cleanVastXml(xmlString: string): string {
  if (xmlString.includes('<VAST') || xmlString.includes('<Ad')) {
    return EMPTY_VAST_XML;
  }
  return xmlString;
}

/**
 * Cài đặt bộ bẫy VAST/VPAID trên window (fetch và XMLHttpRequest)
 */
export function installVastInterceptor(win: Window = window): void {
  try {
    const anyWin = win as any;

    // 1. Bẫy window.fetch
    if (typeof anyWin.fetch === 'function') {
      const originalFetch = anyWin.fetch;
      anyWin.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        if (!input) {
          return originalFetch.call(this, input, init);
        }

        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : typeof (input as any).url === 'string'
                ? (input as any).url
                : '';

        if (url && isVastAdUrl(url)) {
          return new Response(EMPTY_VAST_XML, {
            status: 200,
            headers: {
              'Content-Type': 'application/xml; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        return originalFetch.call(this, input, init);
      };
    }

    // 2. Bẫy XMLHttpRequest
    if (typeof anyWin.XMLHttpRequest === 'function') {
      const OriginalXHR = anyWin.XMLHttpRequest;
      const originalOpen = OriginalXHR.prototype.open;
      const originalSend = OriginalXHR.prototype.send;

      OriginalXHR.prototype.open = function (this: XMLHttpRequest, ...args: any[]) {
        const url = String(args[1] || '');
        (this as any).__isVastAdUrl = isVastAdUrl(url);
        return (originalOpen as any)?.apply(this, args);
      };

      OriginalXHR.prototype.send = function (this: XMLHttpRequest, ...args: any[]) {
        if ((this as any).__isVastAdUrl) {
          // Giả lập phản hồi VAST XML rỗng ngay lập tức
          Object.defineProperty(this, 'readyState', { value: 4, configurable: true, writable: true });
          Object.defineProperty(this, 'status', { value: 200, configurable: true, writable: true });
          Object.defineProperty(this, 'statusText', { value: 'OK', configurable: true, writable: true });
          Object.defineProperty(this, 'responseText', { value: EMPTY_VAST_XML, configurable: true, writable: true });
          Object.defineProperty(this, 'response', { value: EMPTY_VAST_XML, configurable: true, writable: true });

          queueMicrotask(() => {
            this.dispatchEvent(new Event('readystatechange'));
            this.dispatchEvent(new Event('load'));
            this.dispatchEvent(new Event('loadend'));
          });
          return;
        }
        return (originalSend as any)?.apply(this, args);
      };
    }
  } catch {
    // Bỏ qua nếu môi trường khóa can thiệp
  }
}
