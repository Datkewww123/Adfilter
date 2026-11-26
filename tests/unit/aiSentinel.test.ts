import { describe, expect, it, vi } from 'vitest';
import {
  analyzeDriftWithGemini,
  DEFAULT_GEMINI_MODEL,
  detectAnomalies,
  extractInteractionOutputText,
  extractKnownClassTokens,
  formatGitHubIssueMarkdown,
  GEMINI_INTERACTIONS_ENDPOINT,
  validateProposedFindings,
  type PageAuditSnapshot,
} from '../../canary/aiSentinelCore';

describe('AI Canary Sentinel Core', () => {
  it('không báo động (0 tốn token AI) khi các class đã nằm trong danh sách đã biết và không thiếu selector cốt lõi', () => {
    const known = extractKnownClassTokens(['.ytp-ad-module { opacity: 0 } .ytp-skip-ad-button']);
    const snapshot: PageAuditSnapshot = {
      url: 'https://www.youtube.com/watch?v=test',
      hostname: 'www.youtube.com',
      kind: 'video-platform',
      missingCoreSelectors: [],
      unknownAdClasses: ['ytp-ad-module', 'ytp-skip-ad-button'],
      suspectVisibleElements: [],
    };
    const res = detectAnomalies(snapshot, known);
    expect(res.hasAnomaly).toBe(false);
    expect(res.reasons).toEqual([]);
  });

  it('phát hiện chính xác class quảng cáo mới chưa từng có và rút gọn dữ liệu thừa', () => {
    const known = extractKnownClassTokens(['.ytp-ad-module { opacity: 0 }']);
    const snapshot: PageAuditSnapshot = {
      url: 'https://www.youtube.com/watch?v=test',
      hostname: 'www.youtube.com',
      kind: 'video-platform',
      missingCoreSelectors: [],
      unknownAdClasses: ['ytp-ad-module', 'ytp-skip-ad-button-2027'],
      suspectVisibleElements: [],
    };
    const res = detectAnomalies(snapshot, known);
    expect(res.hasAnomaly).toBe(true);
    expect(res.sanitizedSnapshot.unknownAdClasses).toEqual(['ytp-skip-ad-button-2027']);
  });

  it('trích xuất đúng JSON text từ mảng steps của Gemini Interactions API v1', () => {
    const rawRestResponse = {
      id: 'v1_test_123',
      status: 'completed',
      steps: [
        { type: 'thought', signature: 'abc' },
        {
          type: 'model_output',
          content: [{ type: 'text', text: '{"isRealAdOrDrift":true}' }],
        },
      ],
    };
    expect(extractInteractionOutputText(rawRestResponse)).toBe('{"isRealAdOrDrift":true}');
  });

  it('gọi đúng endpoint v1/interactions với model gemini-4-hydrogen và store: false', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'v1_abc',
          status: 'completed',
          steps: [
            {
              type: 'model_output',
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    isRealAdOrDrift: true,
                    confidence: 0.92,
                    summaryVi: 'Trang truyện thêm khung catfish mới ở đáy màn hình.',
                    proposedFilterRules: ['truyentest.vn##.catfish-banner-2027'],
                    proposedVideoSelectors: [],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const snapshot: PageAuditSnapshot = {
      url: 'https://truyentest.vn/chap-1',
      hostname: 'truyentest.vn',
      kind: 'general-web',
      missingCoreSelectors: [],
      unknownAdClasses: [],
      suspectVisibleElements: [
        {
          tag: 'div',
          id: '',
          classes: ['catfish-banner-2027'],
          position: 'fixed',
          zIndex: '99999',
          width: 728,
          height: 90,
          hrefHost: 'promo-partner.example',
          textSnippet: 'Khuyến mãi VIP',
        },
      ],
    };

    const diagnosis = await analyzeDriftWithGemini(snapshot, 'test-api-key', {
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(GEMINI_INTERACTIONS_ENDPOINT);
    const parsedBody = JSON.parse(calledInit.body as string) as Record<string, unknown>;
    expect(parsedBody.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(parsedBody.store).toBe(false);

    const validated = validateProposedFindings(snapshot, ['Phát hiện 1 phần tử nổi'], diagnosis);
    expect(validated).not.toBeNull();
    expect(validated?.acceptedFilterRules).toEqual(['truyentest.vn##.catfish-banner-2027']);

    const issue = formatGitHubIssueMarkdown([validated!], '2026-11-26T00:00:00.000Z');
    expect(issue.title).toContain('[AI Canary]');
    expect(issue.body).toContain('truyentest.vn##.catfish-banner-2027');
  });

  it('Safety Gate tự động chặn quy tắc nguy hiểm (ẩn #movie_player, thẻ chung hoặc rule không gắn domain)', () => {
    const snapshot: PageAuditSnapshot = {
      url: 'https://truyentest.vn/chap-1',
      hostname: 'truyentest.vn',
      kind: 'general-web',
      missingCoreSelectors: [],
      unknownAdClasses: [],
      suspectVisibleElements: [],
    };
    const report = validateProposedFindings(snapshot, ['test'], {
      isRealAdOrDrift: true,
      confidence: 0.95,
      summaryVi: 'Test safety gate',
      proposedFilterRules: [
        '##.global-unscoped-rule',
        'truyentest.vn###movie_player',
        'truyentest.vn##body',
        'truyentest.vn##.safe-ad-banner-box',
      ],
      proposedVideoSelectors: ['#movie_player', 'video', '.ytp-skip-ad-btn-nextgen'],
    });

    expect(report).not.toBeNull();
    expect(report?.acceptedFilterRules).toEqual(['truyentest.vn##.safe-ad-banner-box']);
    expect(report?.rejectedFilterRules).toHaveLength(3);
    expect(report?.acceptedVideoSelectors).toEqual(['.ytp-skip-ad-btn-nextgen']);
  });
});
