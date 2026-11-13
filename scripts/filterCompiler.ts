import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_STATIC_RULES_PER_SET = 30_000;

export const YOUTUBE_PROTECTED_DOMAINS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
] as const;

const YOUTUBE_INFRA_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'googlevideo.com',
  'ytimg.com',
  'i.ytimg.com',
  's.ytimg.com',
]);

const DEFAULT_RESOURCE_TYPES = ['script', 'xmlhttprequest', 'sub_frame', 'image'] as const;

const RESOURCE_TYPE_MAP: Record<string, string> = {
  script: 'script',
  image: 'image',
  stylesheet: 'stylesheet',
  css: 'stylesheet',
  xmlhttprequest: 'xmlhttprequest',
  xhr: 'xmlhttprequest',
  subdocument: 'sub_frame',
  frame: 'sub_frame',
  document: 'main_frame',
  main_frame: 'main_frame',
  media: 'media',
  font: 'font',
  websocket: 'websocket',
  other: 'other',
};

const REDIRECT_RESOURCE_MAP: Record<string, string> = {
  noopjs: '/resources/noop.js',
  'noop.js': '/resources/noop.js',
  nooptext: '/resources/noop.js',
  'empty': '/resources/noop.js',
  noopcss: '/resources/noop.css',
  'noop.css': '/resources/noop.css',
  noophtml: '/resources/noop.html',
  'noop.html': '/resources/noop.html',
  '1x1-transparent.gif': '/resources/1x1.gif',
  '1x1.gif': '/resources/1x1.gif',
  '2x2-transparent.png': '/resources/1x1.gif',
  '3x2-transparent.png': '/resources/1x1.gif',
};

const PROCEDURAL_MARKERS = [':has-text(', ':upward(', ':matches-css(', ':xpath(', ':min-text-length('];

export interface DnrRule {
  id: number;
  priority: number;
  action:
    | { type: 'block' }
    | { type: 'allow' }
    | { type: 'redirect'; redirect: { extensionPath: string } };
  condition: {
    urlFilter: string;
    resourceTypes: string[];
    domainType?: 'firstParty' | 'thirdParty';
    initiatorDomains?: string[];
    excludedInitiatorDomains?: string[];
  };
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

export interface ScriptletEntry {
  name: string;
  args: string[];
  raw: string;
}

export interface ScriptletsIndex {
  version: number;
  global: ScriptletEntry[];
  byDomain: Record<string, ScriptletEntry[]>;
}

export interface CompileStats {
  totalLines: number;
  networkCount: number;
  redirectCount: number;
  exceptionCount: number;
  cosmeticGenericCount: number;
  cosmeticDomainCount: number;
  proceduralCount: number;
  scriptletCount: number;
  skippedYouTubeCount: number;
  skippedUnsupportedCount: number;
}

export interface CompileResult {
  networkRules: DnrRule[];
  redirectRules: DnrRule[];
  cosmetic: CosmeticIndex;
  scriptlets: ScriptletsIndex;
  stats: CompileStats;
}

export interface CompileOptions {
  maxRules?: number;
  startRuleId?: number;
  startRedirectId?: number;
}

function isAscii(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
}

function isYouTubeDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  return (
    YOUTUBE_INFRA_HOSTS.has(d) ||
    d.endsWith('.youtube.com') ||
    d.endsWith('.googlevideo.com') ||
    d.endsWith('.ytimg.com')
  );
}

function targetsYouTubeInfraUrl(urlFilter: string): boolean {
  const lower = urlFilter.toLowerCase();
  for (const host of YOUTUBE_INFRA_HOSTS) {
    if (lower.includes(host)) return true;
  }
  return false;
}

function parseDomainConstraintList(raw: string, separator: ',' | '|'): {
  included: string[];
  excluded: string[];
  hadOnlyYouTube: boolean;
} {
  const parts = raw
    .split(separator)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const included: string[] = [];
  const excluded: string[] = [];
  let sawIncludedYouTube = false;

  for (const part of parts) {
    if (part.startsWith('~')) {
      const d = part.slice(1);
      if (d) excluded.push(d);
    } else if (isYouTubeDomain(part)) {
      sawIncludedYouTube = true;
    } else {
      included.push(part);
    }
  }

  return {
    included,
    excluded,
    hadOnlyYouTube: sawIncludedYouTube && included.length === 0 && parts.some((p) => !p.startsWith('~')),
  };
}

function mergeExcludedDomains(existing: string[] = []): string[] {
  const set = new Set<string>(existing);
  for (const yt of YOUTUBE_PROTECTED_DOMAINS) {
    set.add(yt);
  }
  return [...set];
}

function isCosmeticOrScriptletLine(line: string): boolean {
  return line.includes('##') || line.includes('#@#');
}

function parseScriptletCall(expr: string): ScriptletEntry | null {
  if (!expr.startsWith('+js(') || !expr.endsWith(')')) return null;
  const inner = expr.slice(4, -1).trim();
  if (!inner) return null;

  const parts = inner.split(',').map((p) => p.trim());
  const rawName = parts[0];
  if (!rawName) return null;

  const name = rawName.endsWith('.js') ? rawName.slice(0, -3) : rawName;
  const args = parts.slice(1);
  return { name, args, raw: expr };
}

function isProceduralSelector(selector: string): boolean {
  return PROCEDURAL_MARKERS.some((marker) => selector.includes(marker));
}

function addUnique<T>(list: T[], item: T, keyFn: (x: T) => string = (x) => String(x)): void {
  const key = keyFn(item);
  if (!list.some((existing) => keyFn(existing) === key)) {
    list.push(item);
  }
}

function handleCosmeticLine(
  line: string,
  cosmetic: CosmeticIndex,
  scriptlets: ScriptletsIndex,
  stats: CompileStats
): void {
  const isException = line.includes('#@#');
  const delimiter = isException ? '#@#' : '##';
  const idx = line.indexOf(delimiter);
  const rawDomains = line.slice(0, idx).trim();
  const body = line.slice(idx + delimiter.length).trim();

  if (!body) {
    stats.skippedUnsupportedCount++;
    return;
  }

  const domainInfo = rawDomains
    ? parseDomainConstraintList(rawDomains, ',')
    : { included: [], excluded: [], hadOnlyYouTube: false };

  if (domainInfo.hadOnlyYouTube) {
    stats.skippedYouTubeCount++;
    return;
  }

  if (!isException && body.startsWith('+js(')) {
    const parsed = parseScriptletCall(body);
    if (!parsed) {
      stats.skippedUnsupportedCount++;
      return;
    }
    if (domainInfo.included.length === 0) {
      addUnique(scriptlets.global, parsed, (s) => `${s.name}:${s.args.join(',')}`);
    } else {
      for (const dom of domainInfo.included) {
        scriptlets.byDomain[dom] ??= [];
        addUnique(scriptlets.byDomain[dom], parsed, (s) => `${s.name}:${s.args.join(',')}`);
      }
    }
    stats.scriptletCount++;
    return;
  }

  if (isException) {
    for (const dom of domainInfo.included) {
      cosmetic.exceptionsByDomain[dom] ??= [];
      addUnique(cosmetic.exceptionsByDomain[dom], body);
    }
    return;
  }

  if (isProceduralSelector(body)) {
    cosmetic.procedural.push({
      domains: domainInfo.included,
      excludedDomains: mergeExcludedDomains(domainInfo.excluded),
      raw: body,
    });
    stats.proceduralCount++;
    return;
  }

  if (domainInfo.included.length === 0 && domainInfo.excluded.length === 0) {
    addUnique(cosmetic.generic, body);
    stats.cosmeticGenericCount++;
    return;
  }

  if (domainInfo.included.length === 0 && domainInfo.excluded.length > 0) {
    addUnique(cosmetic.generic, body);
    stats.cosmeticGenericCount++;
    for (const excl of domainInfo.excluded) {
      cosmetic.exceptionsByDomain[excl] ??= [];
      addUnique(cosmetic.exceptionsByDomain[excl], body);
    }
    return;
  }

  for (const dom of domainInfo.included) {
    cosmetic.byDomain[dom] ??= [];
    addUnique(cosmetic.byDomain[dom], body);
    stats.cosmeticDomainCount++;
  }
}

interface ParsedNetworkOptions {
  resourceTypes: string[];
  domainType?: 'firstParty' | 'thirdParty';
  initiatorDomains?: string[];
  excludedInitiatorDomains: string[];
  important: boolean;
  redirectPath?: string;
  unsupported: boolean;
  hadOnlyYouTube: boolean;
}

function parseNetworkOptions(rawOptions: string): ParsedNetworkOptions {
  const tokens = rawOptions
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const resourceSet = new Set<string>();
  const excludedSet = new Set<string>(YOUTUBE_PROTECTED_DOMAINS);
  let initiatorDomains: string[] | undefined;
  let domainType: 'firstParty' | 'thirdParty' | undefined;
  let important = false;
  let redirectPath: string | undefined;
  let hadOnlyYouTube = false;

  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (lower === 'important') {
      important = true;
      continue;
    }
    if (lower === 'third-party' || lower === '3p') {
      domainType = 'thirdParty';
      continue;
    }
    if (lower === '~third-party' || lower === 'first-party' || lower === '1p') {
      domainType = 'firstParty';
      continue;
    }
    if (lower === 'badfilter') {
      return {
        resourceTypes: [],
        excludedInitiatorDomains: [...excludedSet],
        important: false,
        unsupported: true,
        hadOnlyYouTube: false,
      };
    }
    if (lower.startsWith('redirect=') || lower.startsWith('redirect-rule=')) {
      const targetKey = lower.split('=')[1]?.trim() ?? '';
      const mapped = REDIRECT_RESOURCE_MAP[targetKey];
      if (!mapped) {
        return {
          resourceTypes: [],
          excludedInitiatorDomains: [...excludedSet],
          important: false,
          unsupported: true,
          hadOnlyYouTube: false,
        };
      }
      redirectPath = mapped;
      continue;
    }
    if (lower.startsWith('domain=')) {
      const domParsed = parseDomainConstraintList(lower.slice('domain='.length), '|');
      if (domParsed.hadOnlyYouTube) {
        hadOnlyYouTube = true;
      }
      if (domParsed.included.length > 0) {
        initiatorDomains = domParsed.included;
      }
      for (const excl of domParsed.excluded) {
        excludedSet.add(excl);
      }
      continue;
    }

    const mappedResource = RESOURCE_TYPE_MAP[lower];
    if (mappedResource) {
      resourceSet.add(mappedResource);
    }
  }

  return {
    resourceTypes: resourceSet.size > 0 ? [...resourceSet] : [...DEFAULT_RESOURCE_TYPES],
    domainType,
    initiatorDomains,
    excludedInitiatorDomains: [...excludedSet],
    important,
    redirectPath,
    unsupported: false,
    hadOnlyYouTube,
  };
}

function handleNetworkLine(
  line: string,
  networkRules: DnrRule[],
  redirectRules: DnrRule[],
  stats: CompileStats,
  nextRuleId: () => number,
  nextRedirectId: () => number,
  maxRules: number
): void {
  const isException = line.startsWith('@@');
  const body = isException ? line.slice(2).trim() : line;

  const dollarIdx = body.lastIndexOf('$');
  const hasOptions = dollarIdx > 0 && !body.slice(dollarIdx + 1).includes('/');
  const rawFilter = (hasOptions ? body.slice(0, dollarIdx) : body).trim();
  const rawOptions = hasOptions ? body.slice(dollarIdx + 1).trim() : '';

  if (!rawFilter || (rawFilter.startsWith('/') && rawFilter.endsWith('/'))) {
    stats.skippedUnsupportedCount++;
    return;
  }

  if (!isAscii(rawFilter)) {
    stats.skippedUnsupportedCount++;
    return;
  }

  if (targetsYouTubeInfraUrl(rawFilter) && !isException) {
    stats.skippedYouTubeCount++;
    return;
  }

  const parsedOpts = parseNetworkOptions(rawOptions);
  if (parsedOpts.hadOnlyYouTube) {
    stats.skippedYouTubeCount++;
    return;
  }
  if (parsedOpts.unsupported) {
    stats.skippedUnsupportedCount++;
    return;
  }

  const condition: DnrRule['condition'] = {
    urlFilter: rawFilter,
    resourceTypes: parsedOpts.resourceTypes,
    excludedInitiatorDomains: parsedOpts.excludedInitiatorDomains,
  };
  if (parsedOpts.domainType) {
    condition.domainType = parsedOpts.domainType;
  }
  if (parsedOpts.initiatorDomains && parsedOpts.initiatorDomains.length > 0) {
    condition.initiatorDomains = parsedOpts.initiatorDomains;
  }

  if (parsedOpts.redirectPath && !isException) {
    if (redirectRules.length >= maxRules) return;
    redirectRules.push({
      id: nextRedirectId(),
      priority: parsedOpts.important ? 8 : 5,
      action: { type: 'redirect', redirect: { extensionPath: parsedOpts.redirectPath } },
      condition,
    });
    stats.redirectCount++;
    return;
  }

  if (networkRules.length >= maxRules) return;
  networkRules.push({
    id: nextRuleId(),
    priority: isException ? 10 : parsedOpts.important ? 4 : 1,
    action: { type: isException ? 'allow' : 'block' },
    condition,
  });
  if (isException) {
    stats.exceptionCount++;
  } else {
    stats.networkCount++;
  }
}

/**
 * Biên dịch danh sách bộ lọc cú pháp ABP/uBO (EasyList, ABPVN, Custom) thành DNR JSON + Cosmetic/Scriptlet Index.
 * Mọi quy tắc đều tự động loại trừ YouTube để bảo toàn làn xử lý chuyên biệt của extension.
 */
export function compileFilterLines(lines: string[], opts: CompileOptions = {}): CompileResult {
  const maxRules = opts.maxRules ?? MAX_STATIC_RULES_PER_SET;
  let ruleId = opts.startRuleId ?? 1;
  let redirectId = opts.startRedirectId ?? 1;

  const networkRules: DnrRule[] = [];
  const redirectRules: DnrRule[] = [];
  const cosmetic: CosmeticIndex = {
    version: 1,
    generic: [],
    byDomain: {},
    exceptionsByDomain: {},
    procedural: [],
  };
  const scriptlets: ScriptletsIndex = {
    version: 1,
    global: [],
    byDomain: {},
  };
  const stats: CompileStats = {
    totalLines: lines.length,
    networkCount: 0,
    redirectCount: 0,
    exceptionCount: 0,
    cosmeticGenericCount: 0,
    cosmeticDomainCount: 0,
    proceduralCount: 0,
    scriptletCount: 0,
    skippedYouTubeCount: 0,
    skippedUnsupportedCount: 0,
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('!') || line.startsWith('[')) {
      continue;
    }

    if (isCosmeticOrScriptletLine(line)) {
      handleCosmeticLine(line, cosmetic, scriptlets, stats);
    } else {
      handleNetworkLine(
        line,
        networkRules,
        redirectRules,
        stats,
        () => ruleId++,
        () => redirectId++,
        maxRules
      );
    }
  }

  return { networkRules, redirectRules, cosmetic, scriptlets, stats };
}

function mergeCosmeticIndices(indices: CosmeticIndex[]): CosmeticIndex {
  const merged: CosmeticIndex = {
    version: 1,
    generic: [],
    byDomain: {},
    exceptionsByDomain: {},
    procedural: [],
  };

  for (const idx of indices) {
    for (const sel of idx.generic) addUnique(merged.generic, sel);
    for (const [dom, list] of Object.entries(idx.byDomain)) {
      merged.byDomain[dom] ??= [];
      for (const sel of list) addUnique(merged.byDomain[dom], sel);
    }
    for (const [dom, list] of Object.entries(idx.exceptionsByDomain)) {
      merged.exceptionsByDomain[dom] ??= [];
      for (const sel of list) addUnique(merged.exceptionsByDomain[dom], sel);
    }
    for (const proc of idx.procedural) {
      addUnique(merged.procedural, proc, (p) => `${p.domains.join(',')}:${p.raw}`);
    }
  }
  return merged;
}

function mergeScriptletsIndices(indices: ScriptletsIndex[]): ScriptletsIndex {
  const merged: ScriptletsIndex = { version: 1, global: [], byDomain: {} };
  for (const idx of indices) {
    for (const entry of idx.global) {
      addUnique(merged.global, entry, (s) => `${s.name}:${s.args.join(',')}`);
    }
    for (const [dom, entries] of Object.entries(idx.byDomain)) {
      merged.byDomain[dom] ??= [];
      for (const entry of entries) {
        addUnique(merged.byDomain[dom], entry, (s) => `${s.name}:${s.args.join(',')}`);
      }
    }
  }
  return merged;
}

/**
 * Đọc toàn bộ các file `.txt` trong `filters/` và xuất ra DNR rulesets + Cosmetic/Scriptlet index tại `src/rules/`.
 */
export async function compileFilterWorkspace(rootDir: string): Promise<{
  globalRulesCount: number;
  vietnamRulesCount: number;
  redirectRulesCount: number;
  cosmeticCount: number;
  scriptletCount: number;
}> {
  const filtersDir = path.join(rootDir, 'filters');
  const rulesDir = path.join(rootDir, 'src', 'rules');
  await fs.mkdir(rulesDir, { recursive: true });

  const entries = (await fs.readdir(filtersDir)).filter((f) => f.endsWith('.txt')).sort();
  const globalLines: string[] = [];
  const vietnamLines: string[] = [];

  for (const file of entries) {
    const content = await fs.readFile(path.join(filtersDir, file), 'utf8');
    const lines = content.split(/\r?\n/);
    if (file.includes('vietnam') || file.includes('abpvn')) {
      vietnamLines.push(...lines);
    } else {
      globalLines.push(...lines);
    }
  }

  const globalCompiled = compileFilterLines(globalLines);
  const vietnamCompiled = compileFilterLines(vietnamLines, {
    startRedirectId: globalCompiled.redirectRules.length + 1,
  });

  const combinedRedirects = [...globalCompiled.redirectRules, ...vietnamCompiled.redirectRules].slice(
    0,
    MAX_STATIC_RULES_PER_SET
  );
  const mergedCosmetic = mergeCosmeticIndices([globalCompiled.cosmetic, vietnamCompiled.cosmetic]);
  const mergedScriptlets = mergeScriptletsIndices([
    globalCompiled.scriptlets,
    vietnamCompiled.scriptlets,
  ]);

  await Promise.all([
    fs.writeFile(
      path.join(rulesDir, 'rules_global.json'),
      JSON.stringify(globalCompiled.networkRules, null, 2)
    ),
    fs.writeFile(
      path.join(rulesDir, 'rules_vietnam.json'),
      JSON.stringify(vietnamCompiled.networkRules, null, 2)
    ),
    fs.writeFile(
      path.join(rulesDir, 'rules_redirects.json'),
      JSON.stringify(combinedRedirects, null, 2)
    ),
    fs.writeFile(
      path.join(rulesDir, 'cosmetic_index.json'),
      JSON.stringify(mergedCosmetic, null, 2)
    ),
    fs.writeFile(
      path.join(rulesDir, 'scriptlets_index.json'),
      JSON.stringify(mergedScriptlets, null, 2)
    ),
  ]);

  return {
    globalRulesCount: globalCompiled.networkRules.length,
    vietnamRulesCount: vietnamCompiled.networkRules.length,
    redirectRulesCount: combinedRedirects.length,
    cosmeticCount:
      mergedCosmetic.generic.length +
      Object.values(mergedCosmetic.byDomain).reduce((sum, arr) => sum + arr.length, 0) +
      mergedCosmetic.procedural.length,
    scriptletCount:
      mergedScriptlets.global.length +
      Object.values(mergedScriptlets.byDomain).reduce((sum, arr) => sum + arr.length, 0),
  };
}
