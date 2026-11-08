export interface ClickHijackOptions {
  onNeutralized?: (element: HTMLElement) => void;
}

export function isCoveringScreen(el: HTMLElement, win: Window = window): boolean {
  if (!el || el === win.document.body || el === win.document.documentElement) {
    return false;
  }

  // Tối ưu: Kiểm tra kích thước bounding trước để tránh reflow không cần thiết
  const rect = el.getBoundingClientRect();
  const coversWidth = rect.width >= win.innerWidth * 0.8;
  const coversHeight = rect.height >= win.innerHeight * 0.8;
  if (!coversWidth || !coversHeight) {
    return false;
  }

  const computed = win.getComputedStyle(el);
  const position = computed.position || el.style.position;
  const isPositioned = position === 'fixed' || position === 'absolute';
  if (!isPositioned) return false;

  const rawZIndex = computed.zIndex || el.style.zIndex;
  const zIndex = parseInt(rawZIndex, 10);
  const hasHighZIndex = !isNaN(zIndex) && zIndex >= 1000;

  const rawOpacity = computed.opacity || el.style.opacity;
  const opacity = parseFloat(rawOpacity);
  const visibility = computed.visibility || el.style.visibility;
  const isTransparent = opacity < 0.1 || visibility === 'hidden';

  return hasHighZIndex && isTransparent;
}

export function installClickHijackGuard(doc: Document = document, options: ClickHijackOptions = {}): () => void {
  const handler = (e: MouseEvent | PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    if (isCoveringScreen(target, doc.defaultView || window)) {
      // 1. Chặn đứng sự kiện click lan truyền tới mã độc
      e.preventDefault();
      e.stopImmediatePropagation();

      // 2. Vô hiệu hóa pointer-events và xóa vĩnh viễn thẻ tàng hình khỏi DOM
      target.style.pointerEvents = 'none';
      target.remove();

      options.onNeutralized?.(target);
    }
  };

  doc.addEventListener('click', handler, { capture: true });
  doc.addEventListener('pointerdown', handler, { capture: true });

  return () => {
    doc.removeEventListener('click', handler, { capture: true });
    doc.removeEventListener('pointerdown', handler, { capture: true });
  };
}