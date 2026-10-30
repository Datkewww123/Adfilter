import { describe, expect, it } from 'vitest';
import { transformManifest, GECKO_ID, type Manifest } from '../../scripts/transformManifest';

const base = (): Manifest => ({
  manifest_version: 3,
  version: '0.0.0',
  permissions: ['storage'],
  host_permissions: ['*://*.youtube.com/*'],
  background: { service_worker: 'background.js', type: 'module' },
  content_scripts: [
    { matches: ['*://*.youtube.com/*'], js: ['defuser.js'], world: 'MAIN', run_at: 'document_start' },
    { matches: ['*://*.youtube.com/*'], js: ['content.js'], run_at: 'document_start' },
  ],
});

const opts = (o: Partial<{ target: 'chromium' | 'firefox'; dev: boolean; version: string }> = {}) => ({
  target: 'chromium' as const,
  dev: false,
  version: '1.2.3',
  ...o,
});

describe('transformManifest', () => {
  it('giữ nguyên service_worker và world MAIN đối với target chromium', () => {
    const m = transformManifest(base(), opts({ target: 'chromium' }));
    expect(m.background?.service_worker).toBe('background.js');
    expect(m.browser_specific_settings).toBeUndefined();
    expect(m.content_scripts[0].world).toBe('MAIN');
  });

  it('chuyển sang background.scripts và gán gecko id đối với target firefox', () => {
    const m = transformManifest(base(), opts({ target: 'firefox' }));
    expect(m.background?.scripts).toEqual(['background.js']);
    expect(m.background?.service_worker).toBeUndefined();
    expect(m.browser_specific_settings?.gecko.id).toBe(GECKO_ID);
    expect(m.browser_specific_settings?.gecko.strict_min_version).toBe('115.0');
    // Đảm bảo không còn world MAIN trong Firefox để tránh cảnh báo lint
    expect(m.content_scripts[0].world).toBeUndefined();
  });

  it('bổ sung host_permissions và matches cho localhost khi dev: true', () => {
    const m = transformManifest(base(), opts({ dev: true }));
    expect(m.host_permissions).toContain('*://localhost/*');
    expect(m.content_scripts[0].matches).toContain('*://localhost/*');
    expect(m.content_scripts[1].matches).toContain('*://localhost/*');
  });

  it('xử lý đúng semantic version có tag tiền phát hành (-beta, -alpha)', () => {
    const m = transformManifest(base(), opts({ version: '1.2.3-beta.1' }));
    expect(m.version).toBe('1.2.3');
    expect(m.version_name).toBe('1.2.3-beta.1');
  });
});
