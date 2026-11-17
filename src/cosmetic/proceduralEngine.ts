import { isYouTubeHostname, matchesDomainOrSubdomain, type ProceduralCosmeticRule } from './cosmeticEngine';
import { isContentListOrLayoutContainer } from './contentSafety';

export interface ParsedProceduralChain {
  baseSelector: string;
  hasTextPattern?: RegExp;
  matchesCss?: { prop: string; valueRegex: RegExp };
  upwardTarget?: number | string;
}

function escapeRegexLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileTextMatcher(rawArg: string): RegExp | null {
  const trimmed = rawArg.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
    const last = trimmed.lastIndexOf('/');
    const body = trimmed.slice(1, last);
    const flags = trimmed.slice(last + 1) || 'i';
    try {
      return new RegExp(body, flags);
    } catch {
      return new RegExp(escapeRegexLiteral(body), 'i');
    }
  }

  return new RegExp(escapeRegexLiteral(trimmed), 'i');
}

function extractBalancedOperator(
  expr: string,
  operatorName: string
): { arg: string; remainder: string } | null {
  const token = `:${operatorName}(`;
  const idx = expr.indexOf(token);
  if (idx === -1) return null;

  let depth = 1;
  let pos = idx + token.length;
  while (pos < expr.length && depth > 0) {
    const ch = expr[pos];
    if (ch === '(' && expr[pos - 1] !== '\\') depth++;
    else if (ch === ')' && expr[pos - 1] !== '\\') depth--;
    pos++;
  }

  if (depth !== 0) return null;
  const arg = expr.slice(idx + token.length, pos - 1).trim();
  const remainder = `${expr.slice(0, idx)}${expr.slice(pos)}`.trim();
  return { arg, remainder };
}

/**
 * Phân tích chuỗi selector thủ tục kiểu Brave/uBO (`:has-text`, `:upward`, `:matches-css`).
 */
export function parseProceduralSelector(raw: string): ParsedProceduralChain | null {
  let remaining = raw.trim();
  if (!remaining) return null;

  let hasTextPattern: RegExp | undefined;
  let upwardTarget: number | string | undefined;
  let matchesCss: { prop: string; valueRegex: RegExp } | undefined;

  const hasTextOp = extractBalancedOperator(remaining, 'has-text');
  if (hasTextOp) {
    const compiled = compileTextMatcher(hasTextOp.arg);
    if (!compiled) return null;
    hasTextPattern = compiled;
    remaining = hasTextOp.remainder;
  }

  const matchesCssOp = extractBalancedOperator(remaining, 'matches-css');
  if (matchesCssOp) {
    const colonIdx = matchesCssOp.arg.indexOf(':');
    if (colonIdx <= 0) return null;
    const prop = matchesCssOp.arg.slice(0, colonIdx).trim().toLowerCase();
    const valRaw = matchesCssOp.arg.slice(colonIdx + 1).trim();
    const valueRegex = compileTextMatcher(valRaw);
    if (!prop || !valueRegex) return null;
    matchesCss = { prop, valueRegex };
    remaining = matchesCssOp.remainder;
  }

  const upwardOp = extractBalancedOperator(remaining, 'upward');
  if (upwardOp) {
    if (/^\d+$/.test(upwardOp.arg)) {
      upwardTarget = Math.max(1, Number(upwardOp.arg));
    } else if (upwardOp.arg) {
      upwardTarget = upwardOp.arg;
    }
    remaining = upwardOp.remainder;
  }

  if (!hasTextPattern && !matchesCss && upwardTarget === undefined) {
    return null;
  }

  const baseSelector = remaining || '*';
  return { baseSelector, hasTextPattern, matchesCss, upwardTarget };
}

function resolveUpwardTarget(el: HTMLElement, upward?: number | string): HTMLElement | null {
  if (upward === undefined) return el;

  if (typeof upward === 'number') {
    let cursor: HTMLElement | null = el;
    for (let i = 0; i < upward && cursor; i++) {
      cursor = cursor.parentElement;
    }
    return cursor;
  }

  return el.parentElement?.closest<HTMLElement>(upward) ?? null;
}

function isSafeToHideTarget(doc: Document, target: HTMLElement | null): target is HTMLElement {
  return !isContentListOrLayoutContainer(target, doc, {
    allowSingleIframe: true,
    maxTextLength: 600,
    maxAnchors: 4,
  });
}

function isRuleActiveForHost(rule: ProceduralCosmeticRule, hostname: string): boolean {
  if (isYouTubeHostname(hostname)) return false;

  if (rule.excludedDomains.some((dom) => matchesDomainOrSubdomain(hostname, dom))) {
    return false;
  }

  if (rule.domains.length === 0) return true;
  return rule.domains.some((dom) => matchesDomainOrSubdomain(hostname, dom));
}

/**
 * Thực thi các quy tắc procedural selector (`:has-text`, `:upward`, `:matches-css`) lên DOM.
 */
export function applyProceduralCosmeticRules(
  doc: Document,
  rules: ProceduralCosmeticRule[],
  hostname: string
): number {
  if (isYouTubeHostname(hostname) || rules.length === 0) return 0;

  let hiddenCount = 0;
  const view = doc.defaultView;

  for (const rule of rules) {
    if (!isRuleActiveForHost(rule, hostname)) continue;
    const parsed = parseProceduralSelector(rule.raw);
    if (!parsed) continue;

    let candidates: NodeListOf<HTMLElement>;
    try {
      candidates = doc.querySelectorAll<HTMLElement>(parsed.baseSelector);
    } catch {
      continue;
    }

    for (const candidate of Array.from(candidates)) {
      if (parsed.hasTextPattern) {
        const text = (candidate.textContent || '').trim();
        if (!text || text.length > 300 || !parsed.hasTextPattern.test(text)) {
          continue;
        }
      }

      if (parsed.matchesCss) {
        const computed = view?.getComputedStyle?.(candidate);
        const rawVal =
          computed?.getPropertyValue(parsed.matchesCss.prop) ||
          candidate.style.getPropertyValue(parsed.matchesCss.prop) ||
          '';
        if (!parsed.matchesCss.valueRegex.test(rawVal.trim())) {
          continue;
        }
      }

      const target = resolveUpwardTarget(candidate, parsed.upwardTarget);
      if (!isSafeToHideTarget(doc, target)) continue;
      if (target.getAttribute('data-adfilter-procedural') === '1') continue;

      target.setAttribute('data-adfilter-procedural', '1');
      target.style.setProperty('display', 'none', 'important');
      target.style.setProperty('height', '0px', 'important');
      target.style.setProperty('visibility', 'hidden', 'important');
      hiddenCount++;
    }
  }

  return hiddenCount;
}
