/**
 * Interceptor — Bọc window.fetch để lọc quảng cáo trong các request SPA.
 */

const AD_KEYS = [
  'adPlacements',
  'playerAds',
  'adSlots',
  'adBreakParams',
  'adBreakHeartbeatParams',
];

function purgeObject(obj: Record<string, unknown>): void {
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
  const response = await originalFetch(input, init);
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

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

console.log('[AdFilter Stealth] Interceptor đã bọc fetch()');