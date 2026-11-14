// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseProceduralSelector,
  applyProceduralCosmeticRules,
} from '../../src/cosmetic/proceduralEngine';
import type { ProceduralCosmeticRule } from '../../src/cosmetic/cosmeticEngine';

describe('Procedural Cosmetic Engine (:has-text, :upward, :matches-css)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('phân tích chính xác chuỗi :has-text, :upward và :matches-css', () => {
    const p1 = parseProceduralSelector('div:has-text(/^Sponsored$/i):upward(2)');
    expect(p1?.baseSelector).toBe('div');
    expect(p1?.hasTextPattern?.test('Sponsored')).toBe(true);
    expect(p1?.upwardTarget).toBe(2);

    const p2 = parseProceduralSelector('span:has-text(/Tài trợ/i):upward(.card)');
    expect(p2?.baseSelector).toBe('span');
    expect(p2?.upwardTarget).toBe('.card');

    const p3 = parseProceduralSelector('div:matches-css(position: fixed)');
    expect(p3?.baseSelector).toBe('div');
    expect(p3?.matchesCss?.prop).toBe('position');
    expect(p3?.matchesCss?.valueRegex.test('fixed')).toBe(true);
  });

  it('ẩn chính xác card quảng cáo bản địa qua :has-text + :upward mà giữ nguyên bài viết thật', () => {
    document.body.innerHTML = `
      <main id="article-content">
        <div class="real-story"><span class="badge">Tin mới</span><p>Nội dung tin tức chính thống</p></div>
        <div class="native-card" id="sponsored-card">
          <div class="meta"><span>Sponsored</span></div>
          <p>Quảng cáo game đổi thưởng</p>
        </div>
        <div class="vn-card" id="tai-tro-card">
          <div class="tag">Tài trợ bởi đối tác</div>
        </div>
      </main>
    `;

    const rules: ProceduralCosmeticRule[] = [
      { domains: [], excludedDomains: ['youtube.com'], raw: 'span:has-text(/^Sponsored$/i):upward(.native-card)' },
      { domains: [], excludedDomains: ['youtube.com'], raw: 'div:has-text(/Tài trợ/i):upward(1)' },
    ];

    const hidden = applyProceduralCosmeticRules(document, rules, 'vnexpress.net');
    expect(hidden).toBe(2);
    expect((document.getElementById('sponsored-card') as HTMLElement).style.display).toBe('none');
    expect((document.getElementById('tai-tro-card') as HTMLElement).style.display).toBe('none');
    expect((document.querySelector('.real-story') as HTMLElement).style.display).not.toBe('none');
  });

  it('bảo vệ an toàn không ẩn nhầm body, main, article hay nội dung dài', () => {
    document.body.innerHTML = `
      <article id="long-article">
        <div>Sponsored</div>
        <p>${'A'.repeat(650)}</p>
      </article>
    `;

    const rules: ProceduralCosmeticRule[] = [
      { domains: [], excludedDomains: [], raw: 'div:has-text(/^Sponsored$/i):upward(article)' },
    ];

    const hidden = applyProceduralCosmeticRules(document, rules, 'blog.example.com');
    expect(hidden).toBe(0);
    expect((document.getElementById('long-article') as HTMLElement).style.display).not.toBe('none');
  });

  it('tuyệt đối bỏ qua YouTube và tôn trọng excludedDomains', () => {
    document.body.innerHTML = `<div id="card"><span>Sponsored</span></div>`;
    const rules: ProceduralCosmeticRule[] = [
      { domains: [], excludedDomains: ['safe-site.vn', 'youtube.com'], raw: 'span:has-text(/Sponsored/i):upward(#card)' },
    ];

    expect(applyProceduralCosmeticRules(document, rules, 'www.youtube.com')).toBe(0);
    expect(applyProceduralCosmeticRules(document, rules, 'safe-site.vn')).toBe(0);
    expect((document.getElementById('card') as HTMLElement).style.display).not.toBe('none');
  });
});
