import { disguise } from './anti-detect';

const AD_KEYS = [
  'adPlacements',
  'playerAds',
  'adSlots',
  'adBreakParams',
  'adBreakHeartbeatParams',
  'adBreaks',
  'playbackTracking',
];

function purge(obj: unknown): void {
  if (obj == null || typeof obj !== 'object') return;
  const record = obj as Record<string, unknown>;
  for (const key of AD_KEYS) {
    if (key in record) delete record[key];
  }
  // Triệt tiêu cả entries trong response của Shorts
  if (Array.isArray(record.entries)) {
    record.entries = record.entries.filter(
      (entry: any) => !entry?.command?.reelWatchEndpoint?.ad,
    );
  }
}

// ─── 1. Bẫy fetch() có ngụy trang ──────────────────────────────────────────
const originalFetch = window.fetch.bind(window);

async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await originalFetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

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

  open(method: string, url: string | URL, ...rest: any[]): void {
    this._url = typeof url === 'string' ? url : url.href;
    return (super.open as any)(method, url, ...rest);
  }

  get responseText(): string {
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
    if (this.responseType === '' || this.responseType === 'text') {
      return this.responseText;
    }
    return super.response;
  }
}

window.XMLHttpRequest = PatchedXHR as unknown as typeof XMLHttpRequest;

console.log('[AdFilter Stealth] Interceptor đã bọc fetch() & XHR với Anti-Detection');
