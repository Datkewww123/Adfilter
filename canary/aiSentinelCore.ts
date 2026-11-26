import { compileRuntimeFilters } from '../src/background/dynamicFilters';

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
export const GEMINI_INTERACTIONS_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1/interactions';

export interface DomSuspectElement {
  tag: string;
  id: string;
  classes: string[];
  position: string;
  zIndex: string;
  width: number;
  height: number;
  hrefHost: string;
  textSnippet: string;
}

export interface PageAuditSnapshot {
  url: string;
  hostname: string;
  kind: 'video-platform' | 'general-web';
  missingCoreSelectors: string[];
  unknownAdClasses: string[];
  suspectVisibleElements: DomSuspectElement[];
}

export interface AnomalyDetectionResult {
  hasAnomaly: boolean;
  reasons: string[];
  sanitizedSnapshot: PageAuditSnapshot;
}

export interface AiDiagnosisResult {
  isRealAdOrDrift: boolean;
  confidence: number;
  summaryVi: string;
  proposedFilterRules: string[];
  proposedVideoSelectors: string[];
}

export interface ValidatedSiteReport {
  url: string;
  hostname: string;
  reasons: string[];
  summaryVi: string;
  confidence: number;
  acceptedFilterRules: string[];
  rejectedFilterRules: string[];
  acceptedVideoSelectors: string[];
}

const FORBIDDEN_SELECTOR_TOKENS = [
  '#movie_player',
  '.html5-video-player',
  '.html5-main-video',
  'ytd-app',
  'ytd-watch-flexy',
  '#primary',
  '#content',
  '#page-manager',
  '#chapter-content',
  '.reading-detail',
  '.chapter-c',
];

const DANGEROUS_BARE_TAGS = new Set([
  'html',
  'body',
  'main',
  'header',
  'footer',
  'nav',
  'article',
  'section',
  'div',
  'span',
  'a',
  'img',
  'video',
  'iframe',
  'button',
  'input',
  'form',
]);

export const AI_DIAGNOSIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    isRealAdOrDrift: {
      type: 'boolean',
      description:
        'True only if the DOM snapshot indicates a genuine unblocked ad/banner or a broken video-ad selector due to a site update.',
    },
    confidence: {
      type: 'number',
      description: 'Confidence score from 0.0 to 1.0.',
    },
    summaryVi: {
      type: 'string',
      description: 'Concise Vietnamese explanation of what changed on the page.',
    },
    proposedFilterRules: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Safe ABP/uBO domain-scoped cosmetic or network filter rules (e.g. example.com##.new-ad-banner). Never use generic bare tags.',
    },
    proposedVideoSelectors: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Specific CSS selectors for newly introduced skip buttons or ad overlays on the video player, if applicable.',
    },
  },
  required: [
    'isRealAdOrDrift',
    'confidence',
    'summaryVi',
    'proposedFilterRules',
    'proposedVideoSelectors',
  ],
} as const;

export function extractKnownClassTokens(sources: string[]): Set<string> {
  const tokens = new Set<string>();
  const classRegex = /\.([a-zA-Z0-9_-]{3,})/g;
  for (const src of sources) {
    let m: RegExpExecArray | null;
    while ((m = classRegex.exec(src)) !== null) {
      tokens.add(m[1]);
    }
  }
  return tokens;
}

export function detectAnomalies(
  snapshot: PageAuditSnapshot,
  knownClassTokens: ReadonlySet<string>,
): AnomalyDetectionResult {
  const novelAdClasses = Array.from(new Set(snapshot.unknownAdClasses))
    .filter((cls) => !knownClassTokens.has(cls))
    .slice(0, 15);

  const sanitizedSuspects = snapshot.suspectVisibleElements.slice(0, 10).map((el) => ({
    ...el,
    id: el.id.slice(0, 64),
    classes: el.classes.slice(0, 8).map((c) => c.slice(0, 64)),
    hrefHost: el.hrefHost.slice(0, 100),
    textSnippet: el.textSnippet.replace(/\s+/g, ' ').trim().slice(0, 80),
  }));

  const reasons: string[] = [];
  if (snapshot.missingCoreSelectors.length > 0) {
    reasons.push(`Thiếu selector cốt lõi: ${snapshot.missingCoreSelectors.join(', ')}`);
  }
  if (novelAdClasses.length > 0) {
    reasons.push(`Xuất hiện class quảng cáo mới: ${novelAdClasses.join(', ')}`);
  }
  if (sanitizedSuspects.length > 0) {
    reasons.push(`Phát hiện ${sanitizedSuspects.length} phần tử nổi/banner nghi ngờ còn hiển thị`);
  }

  return {
    hasAnomaly: reasons.length > 0,
    reasons,
    sanitizedSnapshot: {
      ...snapshot,
      unknownAdClasses: novelAdClasses,
      suspectVisibleElements: sanitizedSuspects,
    },
  };
}

export function extractInteractionOutputText(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';
  const obj = raw as Record<string, unknown>;
  if (typeof obj.output_text === 'string' && obj.output_text.trim().length > 0) {
    return obj.output_text.trim();
  }
  if (!Array.isArray(obj.steps)) return '';

  const texts: string[] = [];
  for (const step of obj.steps) {
    if (!step || typeof step !== 'object') continue;
    const stepRec = step as Record<string, unknown>;
    if (stepRec.type !== 'model_output' || !Array.isArray(stepRec.content)) continue;
    for (const block of stepRec.content) {
      if (
        block &&
        typeof block === 'object' &&
        (block as Record<string, unknown>).type === 'text' &&
        typeof (block as Record<string, unknown>).text === 'string'
      ) {
        texts.push((block as { text: string }).text);
      }
    }
  }
  return texts.join('').trim();
}

export async function analyzeDriftWithGemini(
  snapshot: PageAuditSnapshot,
  apiKey: string,
  opts?: { model?: string; fetchFn?: typeof fetch },
): Promise<AiDiagnosisResult> {
  const fetchImpl = opts?.fetchFn ?? fetch;
  const model = opts?.model ?? DEFAULT_GEMINI_MODEL;

  const systemInstruction = [
    'Bạn là kỹ sư bảo trì bộ lọc của tiện ích chặn quảng cáo AdFilter (Manifest V3).',
    'Nhiệm vụ: Phân tích bản chụp khung DOM tối giản từ trình duyệt kiểm thử tự động (Canary)',
    'để xác định trang web có thực sự mới cập nhật cấu trúc quảng cáo hoặc đổi class trình phát hay không.',
    'QUY TẮC AN TOÀN TUYỆT ĐỐI:',
    '1. Không bao giờ đề xuất ẩn #movie_player, video, nội dung chính, thanh điều hướng, khung đăng nhập hay CAPTCHA.',
    '2. Mọi quy tắc cosmetic trong proposedFilterRules BẮT BUỘC gắn tên miền cụ thể (ví dụ: domain.com##.ad-box-new), không viết ##div hay quy tắc chung không có tên miền.',
    '3. Nếu các phần tử chỉ là giao diện hợp lệ của trang web, đặt isRealAdOrDrift = false và để mảng rỗng.',
  ].join('\n');

  const res = await fetchImpl(GEMINI_INTERACTIONS_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      system_instruction: systemInstruction,
      input: JSON.stringify(snapshot, null, 2),
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: AI_DIAGNOSIS_JSON_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini Interactions API trả mã lỗi ${res.status}: ${errText.slice(0, 200)}`);
  }

  const payload = (await res.json()) as unknown;
  const outputText = extractInteractionOutputText(payload);
  if (!outputText) {
    throw new Error('Gemini Interactions API không trả về nội dung văn bản JSON.');
  }

  const parsed = JSON.parse(outputText) as Partial<AiDiagnosisResult>;
  return {
    isRealAdOrDrift: Boolean(parsed.isRealAdOrDrift),
    confidence:
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0,
    summaryVi: typeof parsed.summaryVi === 'string' ? parsed.summaryVi.trim() : '',
    proposedFilterRules: Array.isArray(parsed.proposedFilterRules)
      ? parsed.proposedFilterRules.filter((r): r is string => typeof r === 'string')
      : [],
    proposedVideoSelectors: Array.isArray(parsed.proposedVideoSelectors)
      ? parsed.proposedVideoSelectors.filter((s): s is string => typeof s === 'string')
      : [],
  };
}

function isSafeCssSelectorCandidate(selector: string): boolean {
  const s = selector.trim();
  if (!s || s.length > 160) return false;
  if (/[{}<>]|javascript:|expression\s*\(/i.test(s)) return false;
  const lower = s.toLowerCase();
  if (DANGEROUS_BARE_TAGS.has(lower)) return false;
  for (const forbidden of FORBIDDEN_SELECTOR_TOKENS) {
    if (lower.includes(forbidden)) return false;
  }
  return true;
}

export function validateProposedFindings(
  snapshot: PageAuditSnapshot,
  reasons: string[],
  diagnosis: AiDiagnosisResult,
): ValidatedSiteReport | null {
  if (!diagnosis.isRealAdOrDrift || diagnosis.confidence < 0.6) {
    return null;
  }

  const acceptedFilterRules: string[] = [];
  const rejectedFilterRules: string[] = [];

  for (const rawRule of diagnosis.proposedFilterRules) {
    const rule = rawRule.trim();
    if (!rule) continue;

    // Bắt buộc rule cosmetic phải gắn domain cụ thể (không chấp nhận ##.class toàn cục từ AI)
    if (rule.startsWith('##') || rule.startsWith('#?#')) {
      rejectedFilterRules.push(rule);
      continue;
    }

    const cosmeticSplit = rule.indexOf('##');
    if (cosmeticSplit > 0) {
      const domainPart = rule.slice(0, cosmeticSplit).trim();
      const selectorPart = rule.slice(cosmeticSplit + 2).trim();
      if (!domainPart || !isSafeCssSelectorCandidate(selectorPart)) {
        rejectedFilterRules.push(rule);
        continue;
      }
    }

    const compiled = compileRuntimeFilters([rule]);
    const totalCompiled =
      compiled.dnrRules.length +
      compiled.cosmetic.generic.length +
      Object.keys(compiled.cosmetic.byDomain).length +
      compiled.cosmetic.procedural.length;

    if (totalCompiled > 0 && compiled.skippedCount === 0) {
      acceptedFilterRules.push(rule);
    } else {
      rejectedFilterRules.push(rule);
    }
  }

  const acceptedVideoSelectors = diagnosis.proposedVideoSelectors
    .map((s) => s.trim())
    .filter((s) => isSafeCssSelectorCandidate(s));

  if (
    acceptedFilterRules.length === 0 &&
    acceptedVideoSelectors.length === 0 &&
    snapshot.missingCoreSelectors.length === 0
  ) {
    return null;
  }

  return {
    url: snapshot.url,
    hostname: snapshot.hostname,
    reasons,
    summaryVi: diagnosis.summaryVi || 'Phát hiện thay đổi cấu trúc DOM trên trang mục tiêu.',
    confidence: diagnosis.confidence,
    acceptedFilterRules,
    rejectedFilterRules,
    acceptedVideoSelectors,
  };
}

export function formatGitHubIssueMarkdown(
  reports: ValidatedSiteReport[],
  runDateIso: string,
): { title: string; body: string } {
  const dateShort = runDateIso.slice(0, 10);
  const hosts = reports.map((r) => r.hostname).join(', ');
  const title = `[AI Canary] Phát hiện cập nhật cấu trúc quảng cáo (${hosts}) — ${dateShort}`;

  const sections = reports.map((r, idx) => {
    const lines: string[] = [
      `### ${idx + 1}. \`${r.hostname}\` (Độ tin cậy: ${Math.round(r.confidence * 100)}%)`,
      `- **URL kiểm tra:** ${r.url}`,
      `- **Dấu hiệu phát hiện:** ${r.reasons.join('; ')}`,
      `- **Chẩn đoán AI:** ${r.summaryVi}`,
    ];
    if (r.acceptedFilterRules.length > 0) {
      lines.push(
        '- **Quy tắc lọc đề xuất (đã qua kiểm tra an toàn `compileCustomFilters`):**',
        '```text',
        ...r.acceptedFilterRules,
        '```',
      );
    }
    if (r.acceptedVideoSelectors.length > 0) {
      lines.push(
        '- **Selector trình phát đề xuất cập nhật vào `src/content/selectors.ts`:**',
        '```css',
        ...r.acceptedVideoSelectors,
        '```',
      );
    }
    if (r.rejectedFilterRules.length > 0) {
      lines.push(`- *Đã tự động chặn ${r.rejectedFilterRules.length} quy tắc không đạt chuẩn an toàn.*`);
    }
    return lines.join('\n');
  });

  const body = [
    `## Báo cáo Tự động AI Canary Sentinel (${runDateIso})`,
    '',
    '> Báo cáo này được sinh tự động bởi workflow `ai-canary.yml` (Playwright + Gemini Interactions API).',
    '> Toàn bộ quy tắc đề xuất dưới đây đã vượt qua bộ kiểm tra cú pháp và chống ẩn nhầm nội dung chính — vui lòng xem xét trước khi đưa vào `filters/` hoặc `src/content/selectors.ts`.',
    '',
    ...sections,
  ].join('\n\n');

  return { title, body };
}
