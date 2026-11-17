const PROTECTED_CONTAINER_TAGS = new Set([
  'HTML',
  'BODY',
  'MAIN',
  'ARTICLE',
  'HEADER',
  'NAV',
  'FOOTER',
  'UL',
  'OL',
  'TABLE',
  'TBODY',
  'THEAD',
]);

export interface ContentSafetyOptions {
  allowSingleIframe?: boolean;
  maxAnchors?: number;
  maxTextLength?: number;
}

/**
 * Kiểm tra phần tử có phải vùng chứa nội dung chính hoặc danh sách (list truyện, tập phim, chương)
 * để tuyệt đối không leo thẻ cha ẩn nhầm toàn bộ khối nội dung trang web.
 */
export function isContentListOrLayoutContainer(
  el: HTMLElement | null | undefined,
  doc?: Document,
  opts: ContentSafetyOptions = {}
): boolean {
  if (!el) return true;
  if (doc && (el === doc.body || el === doc.documentElement)) return true;
  if (PROTECTED_CONTAINER_TAGS.has(el.tagName)) return true;

  if (el.closest?.('.movie-item, .film-item, .manga-item, #real-article, header, nav')) {
    return true;
  }

  // Bảo vệ các thẻ bao chứa điều khiển, form, video, cấu trúc bài viết hoặc danh sách >= 2 dòng
  if (
    el.querySelector?.(
      'video, form, input, article, main, nav, header, footer, ul li + li, ol li + li, table tr + tr'
    )
  ) {
    return true;
  }

  const iframes = el.querySelectorAll?.('iframe');
  if (iframes && iframes.length > 0) {
    if (!opts.allowSingleIframe || iframes.length > 1) {
      return true;
    }
    const onlyIframe = iframes[0];
    const iframeSrc = onlyIframe.getAttribute('src') || '';
    if (/(?:player|embed|youtube|vimeo|stream)/i.test(iframeSrc)) {
      return true;
    }
  }

  const maxAnchors = opts.maxAnchors ?? 4;
  const anchors = el.querySelectorAll?.('a[href]');
  if (anchors && anchors.length > maxAnchors) {
    return true;
  }

  const maxTextLength = opts.maxTextLength ?? 250;
  const textLen = (el.textContent || '').trim().length;
  if (textLen > maxTextLength) {
    return true;
  }

  return false;
}
