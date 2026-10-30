import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8')) as {
  permissions: string[];
  host_permissions: string[];
};

const ALLOWED_PERMISSIONS = ['storage'];
const ALLOWED_HOSTS = ['*://*.youtube.com/*', '*://youtube.com/*', '*://m.youtube.com/*'];

describe('manifest: không phình quyền', () => {
  it('chỉ dùng các permission đã được duyệt', () => {
    for (const p of manifest.permissions) {
      expect(ALLOWED_PERMISSIONS).toContain(p);
    }
  });

  it('chỉ truy cập các host đã được duyệt', () => {
    expect([...manifest.host_permissions].sort()).toEqual([...ALLOWED_HOSTS].sort());
  });

  it('không đòi quyền toàn cục nguy hiểm', () => {
    const all = [...manifest.permissions, ...manifest.host_permissions];
    expect(all.includes('<all_urls>')).toBe(false);
    expect(all.includes('*://*/*')).toBe(false);
  });
});