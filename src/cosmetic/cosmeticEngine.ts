export interface CosmeticRule {
  domain?: string;
  selector: string;
}

/**
 * Phân tích một dòng quy tắc lọc mỹ phẩm (chuẩn cú pháp Adblock Plus / uBlock Origin)
 * Ví dụ:
 * - "##.banner-ads" -> Rule toàn cục (ẩn trên mọi website)
 * - "nettruyen.com##div[id^='ad_']" -> Rule chỉ ẩn trên nettruyen.com
 * - "! Comment" -> Bỏ qua dòng chú thích
 */
export function parseCosmeticRule(rawLine: string): CosmeticRule | null {
  const line = rawLine.trim();
  if (!line || line.startsWith('!') || line.startsWith('[')) {
    return null; // Bỏ qua dòng trống, comment và metadata header
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
    if (
      !rule.domain ||
      rule.domain === normalizedDomain ||
      normalizedDomain.endsWith('.' + rule.domain)
    ) {
      activeSelectors.push(rule.selector);
    }
  }

  if (activeSelectors.length === 0) return '';

  return `${activeSelectors.join(',\n')} {\n  display: none !important;\n  height: 0 !important;\n  min-height: 0 !important;\n  visibility: hidden !important;\n}`;
}