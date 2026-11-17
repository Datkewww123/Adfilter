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
export const AD_NETWORK_BLOCK_PATTERNS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleads.g.doubleclick.net',
  'adservice.google',
  '/youtubei/v1/ad/',
  '/youtubei/v1/player/ad_break',
  '/pagead/',
  'google.com/pagead',
  '/ads/user-lists/',
  '1p-user-list',
  'viewthroughconversion',
  'backend=innertube',
  'ptype=no_rmkt',
  '/pcs/view',
  '/pcs/activeview',
  '/api/stats/ads',
  '/api/stats/delayplay',
  'ad_data_204',
  'youtube.com/pagead',
];

export function extractRequestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === 'object' && 'url' in input && typeof (input as Request).url === 'string') {
    return (input as Request).url;
  }
  return '';
}

export function isAdNetworkUrl(url: string): boolean {
  return AD_NETWORK_BLOCK_PATTERNS.some((pattern) => url.includes(pattern));
}

export function isPlayerDataUrl(url: string): boolean {
  if (isAdNetworkUrl(url)) return false;
  return (
    url.includes('/youtubei/v1/player') ||
    url.includes('/youtubei/v1/next') ||
    url.includes('/youtubei/v1/get_watch')
  );
}

export function purge(obj: unknown, depth = 0): void {
  if (obj == null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    if (depth <= 2) {
      for (const item of obj) {
        purge(item, depth + 1);
      }
    }
    return;
  }

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

  // Xóa endpoint remarketing gây redirect 302 + CORS error mà giữ nguyên lịch sử xem
  const pt = record.playbackTracking;
  if (pt && typeof pt === 'object' && !Array.isArray(pt)) {
    const ptRecord = pt as Record<string, unknown>;
    delete ptRecord.googleRemarketingUrl;
    delete ptRecord.youtubeRemarketingUrl;
  }

  // Triệt tiêu cả entries trong response của Shorts
  if (Array.isArray(record.entries)) {
    record.entries = record.entries.filter(
      (entry: any) => !entry?.command?.reelWatchEndpoint?.ad,
    );
  }

  if (depth < 2) {
    for (const k of Object.keys(record)) {
      const val = record[k];
      if (val && typeof val === 'object') {
        purge(val, depth + 1);
      }
    }
  } else {
    for (const key of ['playerResponse', 'watchNextResponse', 'data', 'response']) {
      const val = record[key];
      if (val && typeof val === 'object') {
        purge(val, depth + 1);
      }
    }
  }
}

function emptySuccessResponse(): Response {
  return new Response('{}', {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
  });
}

if (typeof window !== 'undefined') {
  // ─── 1. Bẫy fetch() có ngụy trang ────────────────────────────────────────
  const originalFetch = window.fetch.bind(window);

  async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = extractRequestUrl(input);

    // Chặn ngay ad network request và trả về 200 OK '{}' hợp lệ để không gây SyntaxError
    if (isAdNetworkUrl(url)) {
      return emptySuccessResponse();
    }

    const res = await originalFetch(input, init);

    if (isPlayerDataUrl(url)) {
      try {
        const text = await res.text();
        const data = JSON.parse(text);
        purge(data);
        const syntheticRes = new Response(JSON.stringify(data), {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });
        try {
          Object.defineProperty(syntheticRes, 'url', {
            value: res.url,
            configurable: true,
          });
        } catch {}
        return syntheticRes;
      } catch {
        return res;
      }
    }

    return res;
  }

  window.fetch = disguise(patchedFetch as typeof fetch, originalFetch as typeof fetch);

  // ─── 1b. Bẫy Response.prototype.json() (tránh bypass qua C++ JSON parser) ───
  if (typeof Response !== 'undefined' && Response.prototype?.json) {
    const origJson = Response.prototype.json;
    async function patchedResponseJson(this: Response): Promise<unknown> {
      const data = await origJson.call(this);
      purge(data);
      return data;
    }
    Response.prototype.json = disguise(patchedResponseJson, origJson);
  }

  // ─── 2. Bẫy XMLHttpRequest ──────────────────────────────────────────────
  const OrigXHR = window.XMLHttpRequest;

  class PatchedXHR extends OrigXHR {
    private _url = '';
    private _blocked = false;

    open(method: string, url: string | URL, ...rest: any[]): void {
      this._url = extractRequestUrl(url);
      this._blocked = isAdNetworkUrl(this._url);

      // Dùng URL dummy cùng origin '/generate_204' an toàn 100%, không gây lỗi CORS.
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
      if (isPlayerDataUrl(this._url)) {
        try {
          const data = JSON.parse(text);
          purge(data);
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

  console.log('[AdFilter Stealth] Interceptor đã bọc fetch(), Response.json() & XHR với Anti-Detection + Ad Network Block');
}
