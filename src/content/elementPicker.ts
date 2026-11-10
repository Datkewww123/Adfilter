/**
 * Tạo selector CSS duy nhất cho một phần tử DOM để lưu vết chặn cá nhân
 */
export function generateUniqueSelector(el: HTMLElement): string {
  if (el.id && !/^[0-9]/.test(el.id)) {
    return `#${CSS.escape ? CSS.escape(el.id) : el.id}`;
  }

  const validClasses = Array.from(el.classList).filter((c) => !c.includes(':') && !c.includes('/'));
  if (validClasses.length > 0) {
    const classStr = validClasses.map((c) => (CSS.escape ? CSS.escape(c) : c)).join('.');
    return `${el.tagName.toLowerCase()}.${classStr}`;
  }

  let path = el.tagName.toLowerCase();
  let parent = el.parentElement;
  if (parent && parent.children.length > 1) {
    const index = Array.from(parent.children).indexOf(el) + 1;
    path += `:nth-child(${index})`;
  }
  return path;
}

const PICKER_STYLE_OUTLINE = '3px solid #ef4444';
const PICKER_STYLE_BG = 'rgba(239, 68, 68, 0.15)';

/**
 * Khởi động chế độ chọn phần tử trực quan (Element Zapper / Picker).
 * Khi di chuột qua sẽ có khung viền đỏ, bấm vào là phần tử bị xóa ngay lập tức.
 * Bấm phím Escape để hủy bỏ.
 */
export function startElementPicker(
  doc: Document = document,
  onPicked?: (selector: string) => void
): () => void {
  let hoveredEl: HTMLElement | null = null;
  let prevOutline = '';
  let prevBg = '';

  const clearHighlight = () => {
    if (hoveredEl) {
      hoveredEl.style.outline = prevOutline;
      hoveredEl.style.backgroundColor = prevBg;
      hoveredEl = null;
    }
  };

  const handleMouseOver = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target || target === doc.body || target === doc.documentElement) return;

    clearHighlight();
    hoveredEl = target;
    prevOutline = target.style.outline;
    prevBg = target.style.backgroundColor;

    target.style.setProperty('outline', PICKER_STYLE_OUTLINE, 'important');
    target.style.setProperty('background-color', PICKER_STYLE_BG, 'important');
    target.style.setProperty('cursor', 'crosshair', 'important');
  };

  const handleMouseOut = () => {
    clearHighlight();
  };

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = hoveredEl || (e.target as HTMLElement);
    if (!target) return;

    const selector = generateUniqueSelector(target);
    clearHighlight();
    target.remove();

    if (onPicked) {
      onPicked(selector);
    }

    stopPicker();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      clearHighlight();
      stopPicker();
    }
  };

  doc.addEventListener('mouseover', handleMouseOver, { capture: true });
  doc.addEventListener('mouseout', handleMouseOut, { capture: true });
  doc.addEventListener('click', handleClick, { capture: true });
  doc.addEventListener('keydown', handleKeyDown, { capture: true });

  const stopPicker = () => {
    clearHighlight();
    doc.removeEventListener('mouseover', handleMouseOver, { capture: true });
    doc.removeEventListener('mouseout', handleMouseOut, { capture: true });
    doc.removeEventListener('click', handleClick, { capture: true });
    doc.removeEventListener('keydown', handleKeyDown, { capture: true });
  };

  return stopPicker;
}
