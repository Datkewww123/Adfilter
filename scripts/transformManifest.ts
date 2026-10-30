export type Target = 'chromium' | 'firefox';

export interface BuildOptions {
  target: Target;
  dev: boolean;
  version: string;
}

export interface Manifest {
  manifest_version: number;
  version: string;
  version_name?: string;
  permissions: string[];
  host_permissions: string[];
  background?: { service_worker?: string; scripts?: string[]; type?: string };
  content_scripts: Array<{ matches: string[]; js?: string[]; css?: string[]; run_at?: string; world?: string }>;
  browser_specific_settings?: { gecko: { id: string; strict_min_version: string } };
  [key: string]: unknown;
}

// Định danh extension trên Mozilla Add-ons (AMO)
export const GECKO_ID = 'adfilter-local@example.com';

/**
 * Biến đổi manifest gốc để phù hợp với từng môi trường trình duyệt:
 * - chromium: giữ nguyên service_worker và format MV3 của Chrome.
 * - firefox: chuyển background sang dạng scripts array và bổ sung browser_specific_settings.gecko.
 * - dev: bổ sung quyền localhost cho việc test E2E.
 */
export function transformManifest(base: Manifest, opts: BuildOptions): Manifest {
  const m = structuredClone(base);
  const [core] = opts.version.split('-');
  m.version = core ?? opts.version;

  if (opts.target === 'firefox') {
    // Firefox MV3 hỗ trợ background dạng scripts
    m.background = { scripts: ['background.js'] };
    m.browser_specific_settings = {
      gecko: {
        id: GECKO_ID,
        strict_min_version: '115.0',
      },
    };
    // Firefox chưa hỗ trợ "world": "MAIN" trực tiếp trong manifest content_scripts
    // Loại bỏ world: "MAIN" nếu có để tránh cảnh báo web-ext lint
    for (const cs of m.content_scripts) {
      if (cs.world === 'MAIN') {
        delete cs.world;
      }
    }
  } else if (opts.version.includes('-')) {
    m.version_name = opts.version;
  }

  if (opts.dev) {
    if (!m.host_permissions.includes('*://localhost/*')) {
      m.host_permissions.push('*://localhost/*');
    }
    for (const cs of m.content_scripts) {
      if (!cs.matches.includes('*://localhost/*')) {
        cs.matches.push('*://localhost/*');
      }
    }
  }

  return m;
}
