import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('DeclarativeNetRequest Rules', () => {
  const rulesPath = path.resolve(__dirname, '../../src/rules/rules_adnetworks.json');

  it('file rules_adnetworks.json phải tồn tại và là JSON hợp lệ', () => {
    expect(fs.existsSync(rulesPath)).toBe(true);
    const content = fs.readFileSync(rulesPath, 'utf-8');
    const rules = JSON.parse(content);
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('mọi quy tắc phải có id là số nguyên dương duy nhất và action block', () => {
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
    const ids = new Set<number>();

    for (const rule of rules) {
      expect(typeof rule.id).toBe('number');
      expect(rule.id).toBeGreaterThan(0);
      expect(ids.has(rule.id)).toBe(false);
      ids.add(rule.id);

      expect(rule.action).toEqual({ type: 'block' });
      expect(rule.condition).toBeDefined();
      expect(typeof rule.condition.urlFilter).toBe('string');
      expect(Array.isArray(rule.condition.resourceTypes)).toBe(true);
    }
  });

  it('chặn đủ các mạng quảng cáo độc hại chính (adsterra, propellerads, popads, exoclick)', () => {
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
    const filters = rules.map((r: { condition: { urlFilter: string } }) => r.condition.urlFilter);

    expect(filters.some((f: string) => f.includes('adsterra'))).toBe(true);
    expect(filters.some((f: string) => f.includes('propellerads'))).toBe(true);
    expect(filters.some((f: string) => f.includes('popads'))).toBe(true);
    expect(filters.some((f: string) => f.includes('exoclick'))).toBe(true);
  });

  it('chặn đứng các máy chủ quảng cáo & popunder web truyện Việt Nam (mplmncb, clickadu, big88, sunwin)', () => {
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
    const filters = rules.map((r: { condition: { urlFilter: string } }) => r.condition.urlFilter);

    expect(filters).toContain('||mplmncb.com^');
    expect(filters).toContain('||clickadu.com^');
    expect(filters).toContain('||big88.services^');
    expect(filters).toContain('||sunwinchinhhang.com^');
    expect(filters).toContain('||gemwinchinhhang.com^');
  });

  it('các ruleset biên dịch mới (rules_global, rules_vietnam, rules_redirects) hợp lệ & cách ly YouTube', () => {
    const rulesDir = path.resolve(__dirname, '../../src/rules');
    for (const file of ['rules_global.json', 'rules_vietnam.json', 'rules_redirects.json']) {
      const fullPath = path.join(rulesDir, file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);

      const ids = new Set<number>();
      for (const rule of parsed) {
        expect(rule.id).toBeGreaterThan(0);
        expect(ids.has(rule.id)).toBe(false);
        ids.add(rule.id);
        expect(rule.condition.excludedInitiatorDomains).toContain('youtube.com');
      }
    }

    const vietnamRules = JSON.parse(
      fs.readFileSync(path.join(rulesDir, 'rules_vietnam.json'), 'utf-8')
    );
    const vnFilters = vietnamRules.map(
      (r: { condition: { urlFilter: string } }) => r.condition.urlFilter
    );
    expect(vnFilters).toContain('*/template/frontend/js/widget/*');
    expect(vnFilters).toContain('*/api/widget/*');
    expect(vnFilters).toContain('||bondeddarkenedswerve.com^');
    expect(vnFilters).toContain('||assets.yougetwhatyoupayfor.net^');
  });
});
