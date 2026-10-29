import { disguise } from './anti-detect';

const AD_KEYS = [
  'adPlacements',
  'playerAds',
  'adSlots',
  'adBreakParams',
  'adBreakHeartbeatParams',
  'adBreaks',
];

// ─── Danh sách URL patterns của Google Ad Network cần block ngay ───
const AD_NETWORK_BLOCK_PATTERNS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleads.g.doubleclick.net',
  'adservice.google',
  '/youtubei/v1/ad/',
  '/pagead/',
  '/pcs/view',
  '/pcs/activeview',
  '/api/stats/ads',
  '/api/stats/delayplay',
  'youtube.com/pagead',
];

function isAdNetworkUrl(url: string): boolean {
  return AD_NETWORK_BLOCK_PATTERNS.some((pattern) => url.includes(pattern));
}

function purge(obj: unknown): void {
  if (obj == null || typeof obj !== 'object') return;
  const record = obj as Record<string, unknown>;
  for (const key of AD_KEYS) {
    if (key in record) {
      if (key === 'adPlacements' || key === 'playerAds' || key === 'adSlots') {
        record[key] = [];
      } else {
        delete record[key];
      }
    }
  }
  // Triệt tiêu cả entries trong response của Shorts
  if (Array.isArray(record.entries)) {
    record.entries = record.entries.filter(
      (entry: any) => !entry?.command?.reelWatchEndpoint?.ad,
    );
  }
}

function emptySuccessResponse(): Response {
  return new Response('{}', {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── 1. Bẫy fetch() có ngụy trang ──────────────────────────────────────────
const originalFetch = window.fetch.bind(window);

async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

  // Chặn ngay ad network request và trả về 200 OK rỗng
  if (isAdNetworkUrl(url)) {
    return emptySuccessResponse();
  }

  const res = await originalFetch(input, init);

  if (url.includes('/youtubei/v1/player') || url.includes('/youtubei/v1/next')) {
    try {
      const text = await res.text();
      const data = JSON.parse(text);
      purge(data);
      if (data.playerResponse && typeof data.playerResponse === 'object') {
        purge(data.playerResponse);
      }
      return new Response(JSON.stringify(data), {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    } catch {
      return res;
    }
  }

  return res;
}

window.fetch = disguise(patchedFetch as typeof fetch, originalFetch as typeof fetch);

// ─── 2. Bẫy XMLHttpRequest ────────────────────────────────────────────────
const OrigXHR = window.XMLHttpRequest;

class PatchedXHR extends OrigXHR {
  private _url = '';
  private _blocked = false;

  open(method: string, url: string | URL, ...rest: any[]): void {
    this._url = typeof url === 'string' ? url : url.href;
    this._blocked = isAdNetworkUrl(this._url);

    // QUAN TRỌNG: KHÔNG redirect sang 'about:blank' vì sẽ bị trình duyệt chặn CORS:
    // "Access to XMLHttpRequest at 'about:blank' from origin 'https://www.youtube.com' has been blocked by CORS policy"
    // Gây crash luồng JavaScript của YouTube làm đơ/chết đứng màn hình.
    // Dùng URL dummy cùng origin '/generate_204' an toàn 100%.
    if (this._blocked) {
      return (super.open as any)(method, '/generate_204?adfilter_blocked=1', ...rest);
    }
    return (super.open as any)(method, url, ...rest);
  }

  send(body?: Document | XMLHttpRequestBodyInit | null): void {
    if (this._blocked) {
      // Giả lập hoàn tất thành công ngay lập tức để không tạo traffic thật
      try {
        Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
        Object.defineProperty(this, 'status', { value: 204, configurable: true });
        Object.defineProperty(this, 'statusText', { value: 'No Content', configurable: true });
        this.dispatchEvent(new Event('readystatechange'));
        this.dispatchEvent(new Event('load'));
        this.dispatchEvent(new Event('loadend'));
      } catch {}
      return;
    }
    return super.send(body);
  }

  get responseText(): string {
    if (this._blocked) return '{}';
    const text = super.responseText;
    if (this._url.includes('/youtubei/v1/player') || this._url.includes('/youtubei/v1/next')) {
      try {
        const data = JSON.parse(text);
        purge(data);
        if (data.playerResponse && typeof data.playerResponse === 'object') {
          purge(data.playerResponse);
        }
        return JSON.stringify(data);
      } catch {
        return text;
      }
    }
    return text;
  }

  get response(): any {
    if (this._blocked) return '{}';
    if (this.responseType === '' || this.responseType === 'text') {
      return this.responseText;
    }
    return super.response;
  }
}

window.XMLHttpRequest = PatchedXHR as unknown as typeof XMLHttpRequest;

console.log('[AdFilter Stealth] Interceptor đã bọc fetch() & XHR với Anti-Detection + Ad Network Block');
