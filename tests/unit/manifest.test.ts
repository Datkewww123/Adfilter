import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8')) as {
  permissions: string[];
  host_permissions: string[];
  declarative_net_request?: {
    rule_resources: Array<{ id: string; enabled: boolean; path: string }>;
  };
};

const ALLOWED_PERMISSIONS = ['storage', 'declarativeNetRequest'];
const ALLOWED_HOSTS = ['*://*.youtube.com/*', '*://youtube.com/*', '*://m.youtube.com/*', '<all_urls>'];

describe('manifest: không phình quyền & cấu hình hợp lệ', () => {
  it('chỉ dùng các permission đã được duyệt', () => {
    for (const p of manifest.permissions) {
      expect(ALLOWED_PERMISSIONS).toContain(p);
    }
  });

  it('chỉ truy cập các host đã được duyệt cho Universal AdFilter', () => {
    expect([...manifest.host_permissions].sort()).toEqual([...ALLOWED_HOSTS].sort());
  });

  it('có cấu hình declarative_net_request với rule_resources hợp lệ', () => {
    expect(manifest.declarative_net_request).toBeDefined();
    expect(Array.isArray(manifest.declarative_net_request?.rule_resources)).toBe(true);
    expect(manifest.declarative_net_request?.rule_resources[0].id).toBe('ruleset_adnetworks');
  });
});
