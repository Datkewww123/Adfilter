import compiledScriptlets from '../../rules/scriptlets_index.json';
import { SCRIPTLET_REGISTRY } from './coreScriptlets';
import type { ScriptletEntry, ScriptletsIndex } from './types';

function isYouTubeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
}

export function matchRuleDomain(hostname: string, ruleDomain: string): boolean {
  const h = hostname.trim().toLowerCase();
  const d = ruleDomain.trim().toLowerCase();
  if (!h || !d) return false;
  return h === d || h.endsWith(`.${d}`);
}

export function collectScriptletsForHost(
  index: ScriptletsIndex,
  hostname: string
): ScriptletEntry[] {
  if (isYouTubeHost(hostname)) {
    return [];
  }

  const collected: ScriptletEntry[] = [...(index.global ?? [])];
  for (const [ruleDomain, entries] of Object.entries(index.byDomain ?? {})) {
    if (matchRuleDomain(hostname, ruleDomain)) {
      collected.push(...entries);
    }
  }
  return collected;
}

export function executeScriptletEntries(
  win: Window,
  entries: ScriptletEntry[]
): number {
  let executed = 0;
  for (const entry of entries) {
    const handler = SCRIPTLET_REGISTRY[entry.name];
    if (!handler) continue;
    try {
      handler(win, ...(entry.args ?? []));
      executed++;
    } catch {
      // Giữ an toàn cho trang nếu một scriptlet đơn lẻ gặp lỗi
    }
  }
  return executed;
}

/**
 * Nạp và chạy toàn bộ scriptlets từ `scriptlets_index.json` khớp với hostname hiện tại.
 */
export function runCompiledScriptlets(
  win: Window = window,
  hostnameOverride?: string,
  indexOverride?: ScriptletsIndex
): number {
  const host = hostnameOverride ?? win.location?.hostname ?? '';
  if (isYouTubeHost(host)) {
    return 0;
  }

  const index = (indexOverride ?? compiledScriptlets) as ScriptletsIndex;
  const entries = collectScriptletsForHost(index, host);
  return executeScriptletEntries(win, entries);
}
