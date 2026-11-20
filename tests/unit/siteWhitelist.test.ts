import { describe, it, expect } from 'vitest';
import {
  isDomainWhitelisted,
  readCachedSitePaused,
  toggleDomainWhitelist,
  writeCachedSitePaused,
} from '../../src/core/siteWhitelist';

describe('Site Whitelist (Per-Site Whitelist/Toggle)', () => {
  it('kiểm tra tên miền trong danh sách ngoại lệ chính xác (bao gồm subdomain)', () => {
    const whitelist = ['example.com', 'manga.org'];

    expect(isDomainWhitelisted('example.com', whitelist)).toBe(true);
    expect(isDomainWhitelisted('sub.example.com', whitelist)).toBe(true);
    expect(isDomainWhitelisted('deep.sub.manga.org', whitelist)).toBe(true);
    expect(isDomainWhitelisted('google.com', whitelist)).toBe(false);
    expect(isDomainWhitelisted('notexample.com', whitelist)).toBe(false);
    expect(isDomainWhitelisted('', whitelist)).toBe(false);
  });

  it('hàm toggleDomainWhitelist bật/tắt tên miền chuẩn xác', () => {
    let list: string[] = ['site1.com'];

    // Thêm site2.com
    list = toggleDomainWhitelist('site2.com', list);
    expect(list).toEqual(['site1.com', 'site2.com']);

    // Tắt (xóa) site1.com
    list = toggleDomainWhitelist('site1.com', list);
    expect(list).toEqual(['site2.com']);

    // Tắt (xóa) site2.com
    list = toggleDomainWhitelist('site2.com', list);
    expect(list).toEqual([]);
  });

  it('đọc/ghi cache trạng thái tạm dừng cho MAIN world an toàn kể cả khi storage bị khóa', () => {
    const mem = new Map<string, string>();
    const fakeStore = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    };

    expect(readCachedSitePaused(fakeStore)).toBe(false);
    writeCachedSitePaused(true, fakeStore);
    expect(readCachedSitePaused(fakeStore)).toBe(true);
    writeCachedSitePaused(false, fakeStore);
    expect(readCachedSitePaused(fakeStore)).toBe(false);

    const throwingStore = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => writeCachedSitePaused(true, throwingStore)).not.toThrow();
    expect(readCachedSitePaused(throwingStore)).toBe(false);
  });
});
