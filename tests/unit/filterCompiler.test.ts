import { describe, it, expect } from 'vitest';
import {
  compileFilterLines,
  MAX_STATIC_RULES_PER_SET,
  YOUTUBE_PROTECTED_DOMAINS,
} from '../../scripts/filterCompiler';

describe('Filter Compiler (Brave/uBO Syntax -> MV3 DNR & Indices)', () => {
  it('biên dịch network rules, wildcards, $domain= và exception @@|| chuẩn xác', () => {
    const { networkRules, stats } = compileFilterLines([
      '! Comment line should be ignored',
      '[Adblock Plus 2.0]',
      '',
      '||ad-example.com^$third-party,script,image',
      '*/template/frontend/js/widget/*$script,xmlhttprequest',
      '||bad-pop.net^$document,important,domain=sitea.com|~safe.com',
      '@@||good-partner.com^$script',
    ]);

    expect(networkRules).toHaveLength(4);
    expect(stats.networkCount).toBe(3);
    expect(stats.exceptionCount).toBe(1);

    expect(networkRules[0]).toMatchObject({
      id: 1,
      priority: 1,
      action: { type: 'block' },
      condition: {
        urlFilter: '||ad-example.com^',
        domainType: 'thirdParty',
        resourceTypes: ['script', 'image'],
      },
    });

    expect(networkRules[1].condition.urlFilter).toBe('*/template/frontend/js/widget/*');
    expect(networkRules[1].condition.resourceTypes).toEqual(['script', 'xmlhttprequest']);

    expect(networkRules[2]).toMatchObject({
      id: 3,
      priority: 4,
      action: { type: 'block' },
      condition: {
        urlFilter: '||bad-pop.net^',
        resourceTypes: ['main_frame'],
        initiatorDomains: ['sitea.com'],
      },
    });
    expect(networkRules[2].condition.excludedInitiatorDomains).toContain('safe.com');

    expect(networkRules[3]).toMatchObject({
      id: 4,
      priority: 10,
      action: { type: 'allow' },
      condition: {
        urlFilter: '||good-partner.com^',
        resourceTypes: ['script'],
      },
    });
  });

  it('biên dịch $redirect= sang action redirect extensionPath /resources/...', () => {
    const { networkRules, redirectRules } = compileFilterLines([
      '||ads.example.net/ads.js$script,redirect=noopjs,important',
      '||pixel.example.net/t.gif$image,redirect=1x1-transparent.gif',
      '||style.example.net/ad.css$stylesheet,redirect=noopcss',
    ]);

    expect(networkRules).toHaveLength(0);
    expect(redirectRules).toHaveLength(3);
    expect(redirectRules[0]).toMatchObject({
      id: 1,
      priority: 8,
      action: { type: 'redirect', redirect: { extensionPath: '/resources/noop.js' } },
    });
    expect(redirectRules[1].action).toEqual({
      type: 'redirect',
      redirect: { extensionPath: '/resources/1x1.gif' },
    });
    expect(redirectRules[2].action).toEqual({
      type: 'redirect',
      redirect: { extensionPath: '/resources/noop.css' },
    });
  });

  it('tự động cách ly tuyệt đối YouTube trên tất cả tầng DNR, Cosmetic & Scriptlets', () => {
    const { networkRules, redirectRules, cosmetic, scriptlets, stats } = compileFilterLines([
      '||tracker.example.com^$script',
      '||ads.example.com/ad.js$script,redirect=noopjs',
      '||youtube.com/api/stats/ads$xmlhttprequest',
      '||googlevideo.com/videoplayback$media',
      'youtube.com##.ytd-ad-slot-renderer',
      'youtube.com##+js(set, ytInitialPlayerResponse, null)',
      'truyenqqko.com##div.w-overlay',
      'truyenqqko.com##+js(set, __pcHold, true)',
    ]);

    expect(networkRules).toHaveLength(1);
    expect(redirectRules).toHaveLength(1);
    expect(stats.skippedYouTubeCount).toBe(4);

    for (const ytDomain of YOUTUBE_PROTECTED_DOMAINS) {
      expect(networkRules[0].condition.excludedInitiatorDomains).toContain(ytDomain);
      expect(redirectRules[0].condition.excludedInitiatorDomains).toContain(ytDomain);
    }

    expect(cosmetic.byDomain['youtube.com']).toBeUndefined();
    expect(scriptlets.byDomain['youtube.com']).toBeUndefined();
    expect(cosmetic.byDomain['truyenqqko.com']).toEqual(['div.w-overlay']);
    expect(scriptlets.byDomain['truyenqqko.com']).toHaveLength(1);
  });

  it('tách riêng Cosmetic chuẩn, Exception #@#, Procedural (:has-text/:upward) và Scriptlets +js', () => {
    const { cosmetic, scriptlets } = compileFilterLines([
      '##.generic-ad-box',
      'example.org#@#.generic-ad-box',
      'news.vn##.floating-banner',
      '##div:has-text(/Tài trợ/i):upward(1)',
      '##+js(set, canRunAds, true)',
      'example.org##+js(nowoif, popunder)',
    ]);

    expect(cosmetic.generic).toEqual(['.generic-ad-box']);
    expect(cosmetic.exceptionsByDomain['example.org']).toEqual(['.generic-ad-box']);
    expect(cosmetic.byDomain['news.vn']).toEqual(['.floating-banner']);
    expect(cosmetic.procedural).toHaveLength(1);
    expect(cosmetic.procedural[0].raw).toBe('div:has-text(/Tài trợ/i):upward(1)');
    expect(cosmetic.procedural[0].excludedDomains).toContain('youtube.com');

    expect(scriptlets.global[0]).toMatchObject({ name: 'set', args: ['canRunAds', 'true'] });
    expect(scriptlets.byDomain['example.org'][0]).toMatchObject({
      name: 'nowoif',
      args: ['popunder'],
    });
  });

  it('bỏ qua quy tắc non-ASCII / regex phức tạp / badfilter và tôn trọng giới hạn MV3 rule cap', () => {
    const lines = [
      '/regex-ad-pattern/$script',
      '||quảng-cáo.vn^$script',
      '||ignored.com^$badfilter',
      ...Array.from({ length: 15 }, (_, i) => `||ad-${i}.example.com^$script`),
    ];
    const { networkRules, stats } = compileFilterLines(lines, { maxRules: 5 });

    expect(stats.skippedUnsupportedCount).toBe(3);
    expect(networkRules).toHaveLength(5);
    expect(MAX_STATIC_RULES_PER_SET).toBe(30_000);
  });
});
