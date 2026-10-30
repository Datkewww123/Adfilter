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

export const GECKO_ID = 'adfilter-local@example.com';

export function transformManifest(base: Manifest, opts: BuildOptions): Manifest {
  const m = structuredClone(base);
  const [core] = opts.version.split('-');
  m.version = core ?? opts.version;

  if (opts.target === 'firefox') {
    m.background = { scripts: ['background.js'] };
    m.browser_specific_settings = {
      gecko: {
        id: GECKO_ID,
        strict_min_version: '115.0',
      },
    };
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
      m.host_permissions.push('*://localhost/*', 'http://localhost/*');
    }
    for (const cs of m.content_scripts) {
      if (!cs.matches.includes('*://localhost/*')) {
        cs.matches.push('*://localhost/*', 'http://localhost/*');
      }
    }
  }

  return m;
}