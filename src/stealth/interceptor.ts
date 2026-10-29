import { disguise } from './anti-detect';

const AD_KEYS = [
  'adPlacements',
  'playerAds',
  'adSlots',
  'adBreakParams',
  'adBreakHeartbeatParams',
  'adBreaks',
];

// ─── Danh sách URL patterns của Google Ad Network cần block ngay (trả về rỗng tức thì) ───
// Các request này là nguyên nhân gây delay 5-6s vì YouTube chờ auction/impression từ ad server.
const AD_NETWORK_BLOCK_PATTERNS = [
  // Google Ad Server - impression / auction
  'doubleclick.net',
  'googlesyndication.com',
  'googleads.g.doubleclick.net',
  'adservice.google',
  // YouTube ad beacon và impression tracking
  '/youtubei/v1/ad/',
  '/pagead/',
  '/pcs/view',
  '/pcs/activeview',
  // YouTube internal ad telemetry
  '/api/stats/ads',
  '/api/stats/delayplay',
  // YouTube ad system ping
  'youtube.com/pagead',
];

/**
 * Kiểm tra URL có thuộc ad network cần block ngay không.
 * Trả về true nếu cần block (không gửi request thật).
 */
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

/**
 * Tạo response rỗng thành công (200 OK, body "{}") để trả lại ngay lập tức.
 * Giúp YouTube "thỏa mãn" request mà không cần chờ network thật của Google Ad Server.
 */
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

  // Chặn ngay ad network request — KHÔNG gửi tới server, trả về rỗng tức thì
  // Đây là fix chính cho vấn đề delay 5-6 giây khi vào video có quảng cáo.
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
    // Đánh dấu XHR nào cần block (ad network)
    this._blocked = isAdNetworkUrl(this._url);
    if (this._blocked) {
      // Vẫn gọi open để XHR ở trạng thái hợp lệ, redirect sang about:blank
      return (super.open as any)(method, 'about:blank', ...rest);
    }
    return (super.open as any)(method, url, ...rest);
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
