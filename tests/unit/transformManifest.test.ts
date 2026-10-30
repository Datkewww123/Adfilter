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
  it('chromium giữ service_worker, không có gecko', () => {
    const m = transformManifest(base(), opts());
    expect(m.background?.service_worker).toBe('background.js');
    expect(m.browser_specific_settings).toBeUndefined();
    expect(m.content_scripts[0].world).toBe('MAIN');
  });

  it('firefox dùng scripts và có gecko id', () => {
    const m = transformManifest(base(), opts({ target: 'firefox' }));
    expect(m.background?.scripts).toEqual(['background.js']);
    expect(m.background?.service_worker).toBeUndefined();
    expect(m.browser_specific_settings?.gecko.id).toBe(GECKO_ID);
    expect(m.browser_specific_settings?.gecko.strict_min_version).toBe('115.0');
    expect(m.content_scripts[0].world).toBeUndefined();
  });

  it('bản thường không có localhost, bản dev có ở cả hai chỗ', () => {
    const normal = transformManifest(base(), opts());
    expect(JSON.stringify(normal)).not.toContain('localhost');
    const dev = transformManifest(base(), opts({ dev: true }));
    expect(dev.host_permissions).toContain('*://localhost/*');
    expect(dev.content_scripts[0]?.matches).toContain('*://localhost/*');
  });

  it('phiên bản tiền phát hành: cắt hậu tố và đặt version_name cho chromium', () => {
    const m = transformManifest(base(), opts({ version: '0.2.0-rc.1' }));
    expect(m.version).toBe('0.2.0');
    expect(m.version_name).toBe('0.2.0-rc.1');
  });

  it('firefox không đặt version_name', () => {
    const m = transformManifest(base(), opts({ target: 'firefox', version: '0.2.0-rc.1' }));
    expect(m.version_name).toBeUndefined();
  });

  it('không sửa manifest gốc', () => {
    const b = base();
    transformManifest(b, opts({ target: 'firefox', dev: true }));
    expect(b).toEqual(base());
  });
});