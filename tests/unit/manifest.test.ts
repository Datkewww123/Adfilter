import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8')) as {
  description?: string;
  icons?: Record<string, string>;
  action?: { default_icon?: Record<string, string> };
  permissions: string[];
  host_permissions: string[];
  declarative_net_request?: {
    rule_resources: Array<{ id: string; enabled: boolean; path: string }>;
  };
};

const ALLOWED_PERMISSIONS = ['storage', 'declarativeNetRequest'];
const ALLOWED_HOSTS = ['<all_urls>'];

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
    const ids = manifest.declarative_net_request?.rule_resources.map((r) => r.id) ?? [];
    expect(ids[0]).toBe('ruleset_adnetworks');
    expect(ids).toContain('ruleset_global');
    expect(ids).toContain('ruleset_vietnam');
    expect(ids).toContain('ruleset_redirects');
  });

  it('nạp universalDefuser và universalContent vào tất cả iframe (all_frames: true) để bảo vệ player video nhúng', () => {
    const fullManifest = JSON.parse(readFileSync('src/manifest.json', 'utf8')) as {
      content_scripts: Array<{ js?: string[]; all_frames?: boolean }>;
    };
    const universalScripts = fullManifest.content_scripts.filter(
      (cs) => cs.js?.includes('universalDefuser.js') || cs.js?.includes('universalContent.js')
    );
    expect(universalScripts).toHaveLength(2);
    for (const cs of universalScripts) {
      expect(cs.all_frames).toBe(true);
      expect((cs as { match_about_blank?: boolean }).match_about_blank).toBe(true);
      const excluded = (cs as { exclude_matches?: string[] }).exclude_matches ?? [];
      expect(excluded).toContain('*://challenges.cloudflare.com/*');
      expect(excluded).toContain('*://*.hcaptcha.com/*');
      expect(excluded).toContain('*://*.recaptcha.net/*');
      expect(excluded).toContain('*://*/cdn-cgi/challenge-platform/*');
      expect(excluded).toContain('*://*.chatgpt.com/*');
      expect(excluded).toContain('*://*.openai.com/*');
      expect(excluded).toContain('*://accounts.google.com/*');
      expect(excluded).toContain('*://login.microsoftonline.com/*');
    }
  });

  it('khai báo đầy đủ icons 16/32/48/128, tệp tồn tại trên đĩa và mô tả không chứa nhãn hiệu bên thứ ba', () => {
    const requiredSizes = ['16', '32', '48', '128'];
    for (const size of requiredSizes) {
      const iconPath = manifest.icons?.[size];
      const actionIconPath = manifest.action?.default_icon?.[size];
      expect(iconPath).toBe(`icons/icon${size}.png`);
      expect(actionIconPath).toBe(`icons/icon${size}.png`);
      expect(existsSync(resolve('src', iconPath!))).toBe(true);
    }
    expect(manifest.description).toBeDefined();
    expect(manifest.description).not.toMatch(/brave/i);
  });
});
