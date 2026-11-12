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

    expect(filters.some((f: string) => f.includes('mplmncb.com'))).toBe(true);
    expect(filters.some((f: string) => f.includes('clickadu.com'))).toBe(true);
    expect(filters.some((f: string) => f.includes('big88.services'))).toBe(true);
    expect(filters.some((f: string) => f.includes('sunwinchinhhang.com'))).toBe(true);
    expect(filters.some((f: string) => f.includes('gemwinchinhhang.com'))).toBe(true);
  });
});
