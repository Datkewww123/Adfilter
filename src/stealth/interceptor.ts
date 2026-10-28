/**
 * Interceptor — Bọc window.fetch và XMLHttpRequest để lọc quảng cáo trong các request SPA.
 */

const AD_KEYS = [
  'adPlacements',
  'playerAds',
  'adSlots',
  'adBreakParams',
  'adBreakHeartbeatParams',
];

export function purgeObject(obj: Record<string, unknown>): void {
  for (const key of AD_KEYS) {
    if (key in obj) delete obj[key];
  }
}

function isPlayerUrl(url: string): boolean {
  return url.includes('/youtubei/v1/player') || url.includes('/youtubei/v1/next');
}

const originalFetch = window.fetch.bind(window);

window.fetch = async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : (input as Request).url || '';

  const response = await originalFetch(input, init);

  if (isPlayerUrl(url)) {
    try {
      const clone = response.clone();
      const body = (await clone.json()) as Record<string, unknown>;

      purgeObject(body);
      if (body.playerResponse && typeof body.playerResponse === 'object') {
        purgeObject(body.playerResponse as Record<string, unknown>);
      }

      return new Response(JSON.stringify(body), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch {
      return response;
    }
  }

  return response;
};

// Bọc XMLHttpRequest
const XHROpen = XMLHttpRequest.prototype.open;
const XHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (
  this: XMLHttpRequest & { _url?: string },
  method: string,
  url: string | URL,
  ...rest: unknown[]
) {
  this._url = typeof url === 'string' ? url : (url as URL).href || '';
  return XHROpen.apply(this, [method, url, ...rest] as Parameters<typeof XHROpen>);
};

XMLHttpRequest.prototype.send = function (
  this: XMLHttpRequest & { _url?: string },
  ...args: Parameters<typeof XHRSend>
) {
  if (this._url && isPlayerUrl(this._url)) {
    this.addEventListener('readystatechange', () => {
      if (this.readyState === 4) {
        try {
          const body = JSON.parse(this.responseText) as Record<string, unknown>;
          purgeObject(body);
          if (body.playerResponse && typeof body.playerResponse === 'object') {
            purgeObject(body.playerResponse as Record<string, unknown>);
          }
          const text = JSON.stringify(body);
          Object.defineProperty(this, 'responseText', { value: text, configurable: true });
          Object.defineProperty(this, 'response', { value: text, configurable: true });
        } catch {}
      }
    });
  }
  return XHRSend.apply(this, args);
};

console.log('[AdFilter Stealth] Interceptor đã bọc fetch() & XHR');
