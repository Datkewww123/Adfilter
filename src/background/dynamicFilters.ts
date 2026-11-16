import type { ProceduralCosmeticRule } from '../cosmetic/cosmeticEngine';
import { ext } from '../platform/api';

export const FILTER_LISTS_CONFIG_KEY = 'filter_lists_config';
export const CUSTOM_FILTERS_RAW_KEY = 'custom_filter_rules_raw';
export const USER_CUSTOM_COSMETIC_KEY = 'user_custom_cosmetic_rules';
export const DYNAMIC_RULE_ID_START = 100_000;
export const MAX_DYNAMIC_RULES = 1_000;
const MAX_REMOTE_LIST_BYTES = 512 * 1024;

export const YOUTUBE_EXCLUDED_DOMAINS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
] as const;

export interface FilterListsConfig {
  globalEnabled: boolean;
  vietnamEnabled: boolean;
  redirectsEnabled: boolean;
  lastUpdatedAt: number;
  remoteFilterUrls: string[];
}

export const defaultFilterListsConfig: FilterListsConfig = {
  globalEnabled: true,
  vietnamEnabled: true,
  redirectsEnabled: true,
  lastUpdatedAt: 0,
  remoteFilterUrls: [],
};

export interface UserCustomCosmeticStore {
  generic: string[];
  byDomain: Record<string, string[]>;
  procedural: ProceduralCosmeticRule[];
}

export interface RuntimeDnrRule {
  id: number;
  priority: number;
  action: { type: 'block' | 'allow' };
  condition: {
    urlFilter: string;
    resourceTypes: string[];
    domainType?: 'firstParty' | 'thirdParty';
    excludedInitiatorDomains: string[];
  };
}

export interface CompiledRuntimeFilters {
  dnrRules: RuntimeDnrRule[];
  cosmetic: UserCustomCosmeticStore;
  skippedCount: number;
}

const RESOURCE_MAP: Record<string, string> = {
  script: 'script',
  image: 'image',
  stylesheet: 'stylesheet',
  css: 'stylesheet',
  xmlhttprequest: 'xmlhttprequest',
  xhr: 'xmlhttprequest',
  subdocument: 'sub_frame',
  frame: 'sub_frame',
  document: 'main_frame',
  main_frame: 'main_frame',
  media: 'media',
  font: 'font',
  websocket: 'websocket',
  other: 'other',
};

const PROCEDURAL_MARKERS = [':has-text(', ':upward(', ':matches-css('];
const UNSAFE_CSS_SELECTOR_REGEX = /[{}<>]|expression\s*\(|javascript:/i;

function isYouTubeDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  return (
    d === 'youtube.com' ||
    d.endsWith('.youtube.com') ||
    d === 'youtu.be' ||
    d.endsWith('.googlevideo.com') ||
    d.endsWith('.ytimg.com')
  );
}

const YOUTUBE_URL_HOST_REGEX =
  /(?:^|\|\||:\/\/|\.)(?:youtube\.com|youtu\.be|googlevideo\.com|ytimg\.com)(?:[\^/]|$)/i;

function targetsYouTubeHost(urlFilter: string): boolean {
  return YOUTUBE_URL_HOST_REGEX.test(urlFilter);
}

function isAsciiFilter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;
  const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
  return (
    a === 127 ||
    a === 10 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * Kiểm tra URL danh sách lọc từ xa chỉ dùng HTTPS công khai (chống SSRF / file: / javascript:).
 */
export function validateRemoteFilterUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return null;
    if (!parsed.hostname || isPrivateOrLoopbackHost(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Biên dịch danh sách dòng filter chuẩn ABP/uBO thành Chrome MV3 Dynamic Rules & Cosmetic Store.
 * Tự động loại trừ YouTube và kiểm tra an toàn CSS/URL.
 */
export function compileRuntimeFilters(
  lines: string[],
  startRuleId: number = DYNAMIC_RULE_ID_START
): CompiledRuntimeFilters {
  const dnrRules: RuntimeDnrRule[] = [];
  const cosmetic: UserCustomCosmeticStore = {
    generic: [],
    byDomain: {},
    procedural: [],
  };

  let nextId = startRuleId;
  let skippedCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('!') || line.startsWith('[')) continue;

    if (line.includes('##') && !line.includes('#@#')) {
      const idx = line.indexOf('##');
      const rawDomains = line.slice(0, idx).trim();
      const selector = line.slice(idx + 2).trim();

      if (!selector || selector.startsWith('+js(') || UNSAFE_CSS_SELECTOR_REGEX.test(selector)) {
        skippedCount++;
        continue;
      }

      const domains = rawDomains
        ? rawDomains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
        : [];
      const nonYtDomains = domains.filter((d) => !isYouTubeDomain(d));
      if (domains.length > 0 && nonYtDomains.length === 0) {
        skippedCount++;
        continue;
      }

      if (PROCEDURAL_MARKERS.some((m) => selector.includes(m))) {
        cosmetic.procedural.push({
          domains: nonYtDomains,
          excludedDomains: [...YOUTUBE_EXCLUDED_DOMAINS],
          raw: selector,
        });
      } else if (nonYtDomains.length === 0) {
        if (!cosmetic.generic.includes(selector)) cosmetic.generic.push(selector);
      } else {
        for (const dom of nonYtDomains) {
          cosmetic.byDomain[dom] ??= [];
          if (!cosmetic.byDomain[dom].includes(selector)) cosmetic.byDomain[dom].push(selector);
        }
      }
      continue;
    }

    if (line.includes('#@#')) {
      skippedCount++;
      continue;
    }

    if (dnrRules.length >= MAX_DYNAMIC_RULES) {
      skippedCount++;
      continue;
    }

    const isAllow = line.startsWith('@@');
    const body = isAllow ? line.slice(2).trim() : line;
    const dollarIdx = body.lastIndexOf('$');
    const hasOptions = dollarIdx > 0 && !body.slice(dollarIdx + 1).includes('/');
    const urlFilter = (hasOptions ? body.slice(0, dollarIdx) : body).trim();
    const rawOpts = hasOptions ? body.slice(dollarIdx + 1).trim() : '';

    if (
      !urlFilter ||
      urlFilter.length < 4 ||
      (urlFilter.startsWith('/') && urlFilter.endsWith('/')) ||
      !isAsciiFilter(urlFilter) ||
      (!isAllow && targetsYouTubeHost(urlFilter))
    ) {
      skippedCount++;
      continue;
    }

    const resourceTypes: string[] = [];
    let domainType: 'firstParty' | 'thirdParty' | undefined;
    let priority = isAllow ? 10 : 1;

    for (const token of rawOpts.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {
      if (token === 'important' && !isAllow) priority = 4;
      else if (token === 'third-party' || token === '3p') domainType = 'thirdParty';
      else if (token === '~third-party' || token === 'first-party' || token === '1p') {
        domainType = 'firstParty';
      } else if (RESOURCE_MAP[token] && !resourceTypes.includes(RESOURCE_MAP[token])) {
        resourceTypes.push(RESOURCE_MAP[token]);
      }
    }

    const condition: RuntimeDnrRule['condition'] = {
      urlFilter,
      resourceTypes:
        resourceTypes.length > 0 ? resourceTypes : ['script', 'xmlhttprequest', 'sub_frame', 'image'],
      excludedInitiatorDomains: [...YOUTUBE_EXCLUDED_DOMAINS],
    };
    if (domainType) condition.domainType = domainType;

    dnrRules.push({
      id: nextId++,
      priority,
      action: { type: isAllow ? 'allow' : 'block' },
      condition,
    });
  }

  return { dnrRules, cosmetic, skippedCount };
}

export async function getFilterListsConfig(): Promise<FilterListsConfig> {
  const stored = await ext.storage.local.get(FILTER_LISTS_CONFIG_KEY);
  return { ...defaultFilterListsConfig, ...(stored[FILTER_LISTS_CONFIG_KEY] ?? {}) };
}

export async function syncStaticRulesets(config: FilterListsConfig): Promise<void> {
  if (!ext.declarativeNetRequest?.updateEnabledRulesets) return;

  const enableRulesetIds: string[] = [];
  const disableRulesetIds: string[] = [];

  (config.globalEnabled ? enableRulesetIds : disableRulesetIds).push('ruleset_global');
  (config.vietnamEnabled ? enableRulesetIds : disableRulesetIds).push('ruleset_vietnam');
  (config.redirectsEnabled ? enableRulesetIds : disableRulesetIds).push('ruleset_redirects');

  await ext.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds,
    disableRulesetIds,
  });
}

/**
 * Tải nội dung các filter list từ xa (có giới hạn kích thước & timeout an toàn).
 */
export async function fetchRemoteFilterTexts(
  urls: string[],
  fetchFn: typeof fetch = fetch
): Promise<string[]> {
  const safeUrls = urls.map(validateRemoteFilterUrl).filter((u): u is string => u !== null);
  const results: string[] = [];

  for (const url of safeUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const res = await fetchFn(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;

      const text = await res.text();
      if (text.length <= MAX_REMOTE_LIST_BYTES) {
        results.push(text);
      }
    } catch {
      // Bỏ qua nguồn lỗi để không ảnh hưởng các list khác
    }
  }

  return results;
}

/**
 * Đồng bộ hóa toàn bộ DNR Dynamic Rules, Static Ruleset toggles và Custom Cosmetic vào storage.
 */
export async function syncDynamicFilters(
  options: { fetchRemote?: boolean; fetchFn?: typeof fetch } = {}
): Promise<{ dynamicRulesCount: number; cosmeticCount: number }> {
  const config = await getFilterListsConfig();
  await syncStaticRulesets(config);

  const rawStorage = await ext.storage.local.get(CUSTOM_FILTERS_RAW_KEY);
  const customRaw = typeof rawStorage[CUSTOM_FILTERS_RAW_KEY] === 'string'
    ? (rawStorage[CUSTOM_FILTERS_RAW_KEY] as string)
    : '';

  const allLines: string[] = customRaw.split(/\r?\n/);

  if (options.fetchRemote && config.remoteFilterUrls.length > 0) {
    const remoteTexts = await fetchRemoteFilterTexts(config.remoteFilterUrls, options.fetchFn);
    for (const txt of remoteTexts) {
      allLines.push(...txt.split(/\r?\n/));
    }
    config.lastUpdatedAt = Date.now();
    await ext.storage.local.set({ [FILTER_LISTS_CONFIG_KEY]: config });
  }

  const compiled = compileRuntimeFilters(allLines);

  if (ext.declarativeNetRequest?.getDynamicRules && ext.declarativeNetRequest?.updateDynamicRules) {
    const existing = await ext.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing
      .map((r) => r.id)
      .filter((id) => id >= DYNAMIC_RULE_ID_START && id < DYNAMIC_RULE_ID_START + MAX_DYNAMIC_RULES);

    await ext.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: compiled.dnrRules as unknown as chrome.declarativeNetRequest.Rule[],
    });
  }

  await ext.storage.local.set({ [USER_CUSTOM_COSMETIC_KEY]: compiled.cosmetic });

  const cosmeticCount =
    compiled.cosmetic.generic.length +
    Object.values(compiled.cosmetic.byDomain).reduce((sum, list) => sum + list.length, 0) +
    compiled.cosmetic.procedural.length;

  return {
    dynamicRulesCount: compiled.dnrRules.length,
    cosmeticCount,
  };
}
