import { disguise } from './anti-detect';
import {
  normalizeYouTubeAdMode,
  readCachedYouTubeAdMode,
  YT_AD_MODE_MSG_TYPE,
  type YouTubeAdMode,
} from '../storage/config';

const nativeJSONParse = JSON.parse;

let runtimeYouTubeAdMode: YouTubeAdMode = readCachedYouTubeAdMode();

export function getRuntimeYouTubeAdMode(): YouTubeAdMode {
  return runtimeYouTubeAdMode;
}

export function setRuntimeYouTubeAdMode(mode: unknown): void {
  runtimeYouTubeAdMode = normalizeYouTubeAdMode(mode);
}

export function handleYouTubeAdModeMessage(
  event: { source?: unknown; data?: unknown },
  expectedSource?: unknown,
): void {
  if (expectedSource !== undefined && event.source !== expectedSource) return;
  const data = event.data as Record<string, unknown> | null | undefined;
  if (data && typeof data === 'object' && data.type === YT_AD_MODE_MSG_TYPE) {
    setRuntimeYouTubeAdMode(data.mode);
  }
}

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

const AD_SIGNAL_HINT_REGEX =
  /adPlacements|playerAds|adSlots|adBreak|RemarketingUrl|reelWatchEndpoint/;
const FAST_SKIP_SIGNAL_HINT_REGEX = /RemarketingUrl|reelWatchEndpoint/;

export function containsAdSignalText(
  text: string,
  mode: YouTubeAdMode = 'strict-defuser',
): boolean {
  if (text.length < 16) return false;
  return mode === 'fast-skip'
    ? FAST_SKIP_SIGNAL_HINT_REGEX.test(text)
    : AD_SIGNAL_HINT_REGEX.test(text);
}

export function extractRequestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === 'object' && 'url' in input && typeof (input as Request).url === 'string') {
    return (input as Request).url;
  }
  return '';
}

function isFirstPartyYouTubeStatsAdsUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const base =
      typeof window !== 'undefined' &&
      window.location?.href &&
      !window.location.href.startsWith('about:')
        ? window.location.href
        : 'https://localhost';
    const parsed = new URL(url, base);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return false;
    return (
      parsed.pathname === '/api/stats/ads' ||
      parsed.pathname.startsWith('/api/stats/ads/')
    );
  } catch {
    return false;
  }
}

export function isAdNetworkUrl(url: string, mode: YouTubeAdMode = 'strict-defuser'): boolean {
  // Ở chế độ fast-skip (Chế độ A), giữ nguyên chặn mọi 3rd-party, /pagead/ và /player/ad_break;
  // chỉ cho phép ping 1st-party /api/stats/ads của youtube.com để YouTube ghi nhận phiên và miễn QC các video sau.
  if (mode === 'fast-skip' && isFirstPartyYouTubeStatsAdsUrl(url)) {
    return false;
  }
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

/**
 * `/youtubei/v1/get_watch` trả về ReadableStream theo từng chunk (`playerResponse` trước, `watchNextResponse` sau).
 * Nếu đệm toàn bộ bằng `res.clone().text()` trong `fetch()` sẽ làm chậm `loadstart` ~0.8–1s;
 * thay vào đó để YouTube đọc stream trực tiếp và lọc từng chunk khi qua `JSON.parse` ở `defuser.ts`.
 */
export function isStreamingWatchUrl(url: string): boolean {
  return !isAdNetworkUrl(url) && url.includes('/youtubei/v1/get_watch');
}

export function purge(
  obj: unknown,
  depth = 0,
  mode: YouTubeAdMode = 'strict-defuser',
): boolean {
  if (obj == null || typeof obj !== 'object') return false;
  let modified = false;

  if (Array.isArray(obj)) {
    if (depth < 6) {
      for (const item of obj) {
        if (purge(item, depth + 1, mode)) modified = true;
      }
    }
    return modified;
  }

  const record = obj as Record<string, unknown>;
  // Ở chế độ fast-skip (Chế độ A), giữ nguyên adPlacements/playerAds/adSlots/adBreaks để
  // video đầu lướt qua bằng fast-skip + VisualMask (~0.3–1s) và các video sau tải <1s (không bị phạt 6–7s SABR).
  if (mode === 'strict-defuser') {
    for (const key of AD_KEYS) {
      if (key in record) {
        const val = record[key];
        if (key === 'adPlacements' || key === 'playerAds' || key === 'adSlots') {
          const hadAds = Array.isArray(val) ? val.length > 0 : val != null;
          if (!Array.isArray(val) || val.length > 0) {
            record[key] = [];
          }
          if (hadAds) modified = true;
        } else {
          delete record[key];
          modified = true;
        }
      }
    }
  }

  // Xóa endpoint remarketing gây redirect 302 + CORS error mà giữ nguyên lịch sử xem
  const pt = record.playbackTracking;
  if (pt && typeof pt === 'object' && !Array.isArray(pt)) {
    const ptRecord = pt as Record<string, unknown>;
    if ('googleRemarketingUrl' in ptRecord) {
      delete ptRecord.googleRemarketingUrl;
      modified = true;
    }
    if ('youtubeRemarketingUrl' in ptRecord) {
      delete ptRecord.youtubeRemarketingUrl;
      modified = true;
    }
  }

  // Triệt tiêu cả entries trong response của Shorts
  if (Array.isArray(record.entries)) {
    const origLen = record.entries.length;
    const filtered = record.entries.filter(
      (entry: any) => !entry?.command?.reelWatchEndpoint?.ad,
    );
    if (filtered.length < origLen) {
      record.entries = filtered;
      modified = true;
    }
  }

  if (depth < 6) {
    for (const k of Object.keys(record)) {
      const val = record[k];
      if (val && typeof val === 'object') {
        if (purge(val, depth + 1, mode)) modified = true;
      }
    }
  } else if (depth < 8) {
    for (const key of [
      'playerResponse',
      'watchNextResponse',
      'onResponseReceivedEndpoints',
      'onResponseReceivedActions',
      'data',
      'response',
      'contents',
    ]) {
      const val = record[key];
      if (val && typeof val === 'object') {
        if (purge(val, depth + 1, mode)) modified = true;
      }
    }
  }

  return modified;
}

function emptySuccessResponse(url: string): Response {
  if (url.includes('ad_status')) {
    return new Response('window.google_ad_status = 1;', {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
  return new Response('{}', {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
  });
}

if (typeof window !== 'undefined') {
  runtimeYouTubeAdMode = readCachedYouTubeAdMode();
  try {
    window.addEventListener('message', (event: MessageEvent) => {
      handleYouTubeAdModeMessage(event, window);
    });
  } catch {}

  // ─── 1. Bẫy fetch() có ngụy trang ────────────────────────────────────────
  const originalFetch = window.fetch.bind(window);

  async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = extractRequestUrl(input);
    const mode = getRuntimeYouTubeAdMode();

    // Chặn ngay ad network request và trả về 200 OK đúng định dạng để không gây lỗi/timeout
    if (isAdNetworkUrl(url, mode)) {
      return emptySuccessResponse(url);
    }

    const res = await originalFetch(input, init);

    if (isPlayerDataUrl(url) && !isStreamingWatchUrl(url)) {
      try {
        const text = await res.clone().text();
        if (!containsAdSignalText(text, mode)) {
          return res;
        }
        const data = nativeJSONParse(text);
        if (!purge(data, 0, mode)) {
          return res;
        }
        const cleanHeaders = new Headers(res.headers);
        cleanHeaders.delete('content-encoding');
        cleanHeaders.delete('content-length');
        const syntheticRes = new Response(JSON.stringify(data), {
          status: res.status,
          statusText: res.statusText,
          headers: cleanHeaders,
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
      purge(data, 0, getRuntimeYouTubeAdMode());
      return data;
    }
    Response.prototype.json = disguise(patchedResponseJson, origJson);
  }

  // ─── 2. Bẫy XMLHttpRequest có ngụy trang [native code] ──────────────────
  const OrigXHR = window.XMLHttpRequest;

  class PatchedXHR extends OrigXHR {
    private _url = '';
    private _blocked = false;

    open(method: string, url: string | URL, ...rest: any[]): void {
      this._url = extractRequestUrl(url);
      this._blocked = isAdNetworkUrl(this._url, getRuntimeYouTubeAdMode());

      // Dùng endpoint sạch cùng origin '/generate_204', không gắn query nhận diện adfilter
      if (this._blocked) {
        return (super.open as any)(method, '/generate_204', ...rest);
      }
      return (super.open as any)(method, url, ...rest);
    }

    send(body?: Document | XMLHttpRequestBodyInit | null): void {
      if (this._blocked) {
        // Hoàn tất bất đồng bộ đúng chuẩn XHR để không gây lệch chu kỳ đọc
        const emitBlockedComplete = () => {
          try {
            Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
            Object.defineProperty(this, 'status', { value: 204, configurable: true });
            Object.defineProperty(this, 'statusText', { value: 'No Content', configurable: true });
            this.dispatchEvent(new Event('readystatechange'));
            this.dispatchEvent(new Event('load'));
            this.dispatchEvent(new Event('loadend'));
          } catch {}
        };
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(emitBlockedComplete);
        } else {
          emitBlockedComplete();
        }
        return;
      }
      return super.send(body);
    }

    get responseText(): string {
      if (this._blocked) return '{}';
      const text = super.responseText;
      const mode = getRuntimeYouTubeAdMode();
      if (isPlayerDataUrl(this._url) && containsAdSignalText(text, mode)) {
        try {
          const data = nativeJSONParse(text);
          if (purge(data, 0, mode)) {
            return JSON.stringify(data);
          }
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
      const raw = super.response;
      const mode = getRuntimeYouTubeAdMode();
      if (this.responseType === 'json' && isPlayerDataUrl(this._url) && raw && typeof raw === 'object') {
        purge(raw, 0, mode);
      }
      return raw;
    }
  }

  disguise(PatchedXHR.prototype.open as (...args: any[]) => any, OrigXHR.prototype.open as (...args: any[]) => any);
  disguise(PatchedXHR.prototype.send as (...args: any[]) => any, OrigXHR.prototype.send as (...args: any[]) => any);
  window.XMLHttpRequest = disguise(
    PatchedXHR as unknown as (...args: any[]) => any,
    OrigXHR as unknown as (...args: any[]) => any,
  ) as unknown as typeof XMLHttpRequest;

  console.log('[AdFilter Stealth] Interceptor đã bọc fetch(), Response.json() & XHR với Anti-Detection + Fast-Path');
}
