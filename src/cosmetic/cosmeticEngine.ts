export interface CosmeticRule {
  domain?: string;
  selector: string;
}

export interface ProceduralCosmeticRule {
  domains: string[];
  excludedDomains: string[];
  raw: string;
}

export interface CosmeticIndex {
  version: number;
  generic: string[];
  byDomain: Record<string, string[]>;
  exceptionsByDomain: Record<string, string[]>;
  procedural: ProceduralCosmeticRule[];
}

export function isYouTubeHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === 'youtube.com' || h.endsWith('.youtube.com') || h === 'youtu.be';
}

function isYouTubeOrEmbedHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return (
    isYouTubeHostname(h) ||
    h === 'youtube-nocookie.com' ||
    h.endsWith('.youtube-nocookie.com')
  );
}

function extractHostnameFromUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Nhận diện ngữ cảnh YouTube gồm cả trang chính lẫn các iframe `about:blank` / `about:srcdoc`
 * do YouTube tạo ra (ví dụ `#chatframe` lúc khởi tạo), giúp không tiêm nhầm bộ lọc phổ thông.
 */
export function isYouTubeContext(
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
): boolean {
  if (!win) return false;
  try {
    const loc = win.location;
    if (loc) {
      if (isYouTubeOrEmbedHost(loc.hostname || '') || loc.pathname?.includes('watch.html')) {
        return true;
      }

      const origins = loc.ancestorOrigins;
      if (origins && origins.length > 0) {
        for (let i = 0; i < origins.length; i++) {
          if (isYouTubeOrEmbedHost(extractHostnameFromUrl(origins[i]))) {
            return true;
          }
        }
      }
    }

    const referrer = doc?.referrer || win.document?.referrer || '';
    if (referrer && isYouTubeOrEmbedHost(extractHostnameFromUrl(referrer))) {
      return true;
    }

    if (win.parent && win.parent !== win) {
      try {
        const parentHost = win.parent.location?.hostname || '';
        if (isYouTubeOrEmbedHost(parentHost)) return true;
      } catch {
        // Cross-origin parent frame — bỏ qua an toàn
      }
    }
  } catch {}
  return false;
}

export function matchesDomainOrSubdomain(hostname: string, ruleDomain: string): boolean {
  const h = hostname.trim().toLowerCase();
  const d = ruleDomain.trim().toLowerCase();
  if (!h || !d) return false;
  return h === d || h.endsWith(`.${d}`);
}

/**
 * Phân tích một dòng quy tắc lọc mỹ phẩm (chuẩn cú pháp Adblock Plus / uBlock Origin)
 */
export function parseCosmeticRule(rawLine: string): CosmeticRule | null {
  const line = rawLine.trim();
  if (!line || line.startsWith('!') || line.startsWith('[')) {
    return null;
  }

  const separatorIndex = line.indexOf('##');
  if (separatorIndex === -1) {
    return null;
  }

  const domainPart = line.substring(0, separatorIndex).trim();
  const selectorPart = line.substring(separatorIndex + 2).trim();

  if (!selectorPart) return null;

  return {
    domain: domainPart ? domainPart.toLowerCase() : undefined,
    selector: selectorPart,
  };
}

/**
 * Tạo mã CSS để tiêm trực tiếp vào trang web hiện tại khớp theo domain
 */
export function generateInjectedCss(rules: CosmeticRule[], currentDomain: string): string {
  const activeSelectors: string[] = [];
  const normalizedDomain = currentDomain.toLowerCase();

  for (const rule of rules) {
    if (!rule.domain || matchesDomainOrSubdomain(normalizedDomain, rule.domain)) {
      activeSelectors.push(rule.selector);
    }
  }

  return formatCosmeticCssBlock(activeSelectors);
}

/**
 * Thu thập các selector hợp lệ cho domain hiện tại từ `cosmetic_index.json`,
 * tự động loại trừ ngoại lệ `#@#` và cách ly tuyệt đối YouTube.
 */
export function collectCosmeticSelectorsForHost(
  index: CosmeticIndex,
  currentDomain: string,
  extraSelectors: string[] = []
): string[] {
  if (isYouTubeHostname(currentDomain)) {
    return [];
  }

  const excluded = new Set<string>();
  for (const [dom, list] of Object.entries(index.exceptionsByDomain ?? {})) {
    if (matchesDomainOrSubdomain(currentDomain, dom)) {
      for (const sel of list) excluded.add(sel);
    }
  }

  const result: string[] = [];
  const seen = new Set<string>();

  const pushIfAllowed = (sel: string) => {
    const trimmed = sel.trim();
    if (!trimmed || excluded.has(trimmed) || seen.has(trimmed)) return;
    seen.add(trimmed);
    result.push(trimmed);
  };

  for (const sel of extraSelectors) pushIfAllowed(sel);
  for (const sel of index.generic ?? []) pushIfAllowed(sel);

  for (const [dom, list] of Object.entries(index.byDomain ?? {})) {
    if (matchesDomainOrSubdomain(currentDomain, dom)) {
      for (const sel of list) pushIfAllowed(sel);
    }
  }

  return result;
}

export function formatCosmeticCssBlock(selectors: string[]): string {
  if (selectors.length === 0) return '';
  return `${selectors.join(',\n')} {\n  display: none !important;\n  height: 0 !important;\n  min-height: 0 !important;\n  visibility: hidden !important;\n}`;
}

/**
 * Sinh chuỗi CSS Zero-FOUC hoàn chỉnh từ `cosmetic_index.json` + fallback selectors.
 */
export function generateCosmeticCssFromIndex(
  index: CosmeticIndex,
  currentDomain: string,
  extraSelectors: string[] = []
): string {
  const selectors = collectCosmeticSelectorsForHost(index, currentDomain, extraSelectors);
  return formatCosmeticCssBlock(selectors);
}
