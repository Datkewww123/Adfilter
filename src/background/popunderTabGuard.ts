import { ext } from '../platform/api';
import { isDomainWhitelisted } from '../core/siteWhitelist';
import { isSuspiciousUrl } from '../stealth/urlBlockRegistry';

const POPUNDER_TRACK_TTL_MS = 15_000;

interface TrackedChildTab {
  openerTabId: number;
  createdAt: number;
}

const trackedChildTabs = new Map<number, TrackedChildTab>();

function pruneExpiredTrackedTabs(now: number): void {
  for (const [id, info] of trackedChildTabs.entries()) {
    if (now - info.createdAt > POPUNDER_TRACK_TTL_MS) {
      trackedChildTabs.delete(id);
    }
  }
}

export function clearTrackedPopunderTabs(): void {
  trackedChildTabs.clear();
}

export function isHttpOrHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Kiểm tra và tự động đóng ngay tab popunder vừa mở từ một tab khác (ví dụ qua 302 redirect `/go` -> `bom88.adqc.net`),
 * đồng thời kéo focus về lại tab phim ban đầu mà không đụng tab do người dùng tự mở mới.
 */
export async function handlePopunderTabNavigation(
  tabId: number,
  candidateUrl: string | undefined,
  openerTabId?: number,
  now: number = Date.now(),
  whitelist: string[] = []
): Promise<boolean> {
  pruneExpiredTrackedTabs(now);

  if (openerTabId !== undefined && openerTabId !== tabId && !trackedChildTabs.has(tabId)) {
    trackedChildTabs.set(tabId, { openerTabId, createdAt: now });
  }

  const tracked = trackedChildTabs.get(tabId);
  if (!tracked || now - tracked.createdAt > POPUNDER_TRACK_TTL_MS) {
    return false;
  }

  if (!candidateUrl || !isHttpOrHttpsUrl(candidateUrl) || !isSuspiciousUrl(candidateUrl)) {
    return false;
  }

  try {
    const destHost = new URL(candidateUrl).hostname;
    if (isDomainWhitelisted(destHost, whitelist)) {
      return false;
    }
  } catch {
    return false;
  }

  trackedChildTabs.delete(tabId);
  try {
    await ext.tabs?.remove?.(tabId);
    if (tracked.openerTabId !== undefined) {
      await ext.tabs?.update?.(tracked.openerTabId, { active: true });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Lắp bộ canh gác tab popunder trong Service Worker (dùng host_permissions <all_urls>, không cần quyền `tabs`).
 */
export function installPopunderTabGuard(): void {
  if (!ext.tabs) return;

  let cachedWhitelist: string[] = [];
  try {
    void ext.storage?.local?.get?.(['whitelist_domains'])?.then?.((data: Record<string, unknown>) => {
      if (Array.isArray(data?.whitelist_domains)) {
        cachedWhitelist = data.whitelist_domains as string[];
      }
    });
    ext.storage?.onChanged?.addListener?.((changes, area) => {
      if (area === 'local' && changes.whitelist_domains) {
        cachedWhitelist = Array.isArray(changes.whitelist_domains.newValue)
          ? (changes.whitelist_domains.newValue as string[])
          : [];
      }
    });
  } catch {}

  ext.tabs.onCreated?.addListener?.((tab) => {
    if (tab.id === undefined) return;
    const url = tab.pendingUrl || tab.url;
    void handlePopunderTabNavigation(tab.id, url, tab.openerTabId, Date.now(), cachedWhitelist);
  });

  ext.tabs.onUpdated?.addListener?.((tabId, changeInfo, tab) => {
    const url = changeInfo.url || tab.pendingUrl || tab.url;
    if (!url) return;
    void handlePopunderTabNavigation(tabId, url, tab.openerTabId, Date.now(), cachedWhitelist);
  });

  ext.tabs.onRemoved?.addListener?.((tabId) => {
    trackedChildTabs.delete(tabId);
  });
}
