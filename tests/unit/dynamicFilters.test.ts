import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  compileRuntimeFilters,
  validateRemoteFilterUrl,
  syncDynamicFilters,
  DYNAMIC_RULE_ID_START,
  FILTER_LISTS_CONFIG_KEY,
  CUSTOM_FILTERS_RAW_KEY,
  USER_CUSTOM_COSMETIC_KEY,
} from '../../src/background/dynamicFilters';

describe('Dynamic Filters & Remote Updater (Week 29)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('chỉ chấp nhận URL HTTPS công khai hợp lệ, chặn HTTP / SSRF localhost / private IP / javascript:', () => {
    expect(
      validateRemoteFilterUrl('https://raw.githubusercontent.com/abpvn/abpvn/master/filter/abpvn.txt')
    ).toBe('https://raw.githubusercontent.com/abpvn/abpvn/master/filter/abpvn.txt');

    expect(validateRemoteFilterUrl('http://example.com/list.txt')).toBeNull();
    expect(validateRemoteFilterUrl('javascript:alert(1)')).toBeNull();
    expect(validateRemoteFilterUrl('file:///etc/passwd')).toBeNull();
    expect(validateRemoteFilterUrl('https://localhost/list.txt')).toBeNull();
    expect(validateRemoteFilterUrl('https://127.0.0.1/list.txt')).toBeNull();
    expect(validateRemoteFilterUrl('https://192.168.1.10/list.txt')).toBeNull();
    expect(validateRemoteFilterUrl('https://10.0.0.1/list.txt')).toBeNull();
    expect(validateRemoteFilterUrl('https://169.254.169.254/latest/meta-data')).toBeNull();
  });

  it('biên dịch dynamic rules, cosmetic, procedural, chống XSS selector và cách ly YouTube', () => {
    const result = compileRuntimeFilters([
      '! Comment',
      '||spam-ad.example^$third-party,script,important',
      '@@||safe-partner.example^$script',
      '||youtube.com/api/stats/ads$xmlhttprequest',
      'youtube.com##.ytd-ad-slot',
      'truyenqqko.com##[data-zone="popup"]',
      '##.generic-promo',
      '##div:has-text(/Tài trợ/i):upward(1)',
      '##div{background:url(javascript:alert(1))}',
      '##div</style><script>alert(1)</script>',
    ]);

    expect(result.dnrRules).toHaveLength(2);
    expect(result.dnrRules[0]).toMatchObject({
      id: DYNAMIC_RULE_ID_START,
      priority: 4,
      action: { type: 'block' },
      condition: {
        urlFilter: '||spam-ad.example^',
        domainType: 'thirdParty',
        resourceTypes: ['script'],
      },
    });
    expect(result.dnrRules[0].condition.excludedInitiatorDomains).toContain('youtube.com');

    expect(result.dnrRules[1]).toMatchObject({
      id: DYNAMIC_RULE_ID_START + 1,
      priority: 10,
      action: { type: 'allow' },
    });

    expect(result.cosmetic.byDomain['youtube.com']).toBeUndefined();
    expect(result.cosmetic.byDomain['truyenqqko.com']).toEqual(['[data-zone="popup"]']);
    expect(result.cosmetic.generic).toEqual(['.generic-promo']);
    expect(result.cosmetic.procedural).toHaveLength(1);
    expect(result.skippedCount).toBe(4);
  });

  it('syncDynamicFilters đồng bộ static rulesets, dynamic DNR rules và tải remote filter lists an toàn', async () => {
    const store: Record<string, unknown> = {
      [FILTER_LISTS_CONFIG_KEY]: {
        globalEnabled: true,
        vietnamEnabled: false,
        redirectsEnabled: true,
        lastUpdatedAt: 0,
        remoteFilterUrls: ['https://filters.example.org/abpvn.txt'],
      },
      [CUSTOM_FILTERS_RAW_KEY]: '||custom-ad.example^$script\nsite.vn##.bad-box',
    };

    const updateEnabledRulesets = vi.fn().mockResolvedValue(undefined);
    const getDynamicRules = vi.fn().mockResolvedValue([{ id: DYNAMIC_RULE_ID_START }]);
    const updateDynamicRules = vi.fn().mockResolvedValue(undefined);

    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: store[key] })),
          set: vi.fn(async (patch: Record<string, unknown>) => Object.assign(store, patch)),
        },
      },
      declarativeNetRequest: {
        updateEnabledRulesets,
        getDynamicRules,
        updateDynamicRules,
      },
    };

    // Reload module mocks by passing mocked global chrome via ext? ext reads globalThis.chrome at module load;
    // instead test via ext or fetchFn directly:
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '||remote-ad.example^$image',
    });

    const { ext } = await import('../../src/platform/api');
    Object.assign(ext, {
      storage: (globalThis as unknown as { chrome: typeof chrome }).chrome.storage,
      declarativeNetRequest: (globalThis as unknown as { chrome: typeof chrome }).chrome
        .declarativeNetRequest,
    });

    const summary = await syncDynamicFilters({
      fetchRemote: true,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(updateEnabledRulesets).toHaveBeenCalledWith({
      enableRulesetIds: ['ruleset_global', 'ruleset_redirects'],
      disableRulesetIds: ['ruleset_vietnam'],
    });
    expect(updateDynamicRules).toHaveBeenCalledWith(
      expect.objectContaining({
        removeRuleIds: [DYNAMIC_RULE_ID_START],
      })
    );
    expect(summary.dynamicRulesCount).toBe(2);
    expect(summary.cosmeticCount).toBe(1);
    expect(
      (store[USER_CUSTOM_COSMETIC_KEY] as { byDomain: Record<string, string[]> }).byDomain[
        'site.vn'
      ]
    ).toEqual(['.bad-box']);
  });
});
