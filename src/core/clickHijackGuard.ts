export interface ClickHijackOptions {
  onNeutralized?: (element: HTMLElement) => void;
}

function isTransparentClickCatcher(el: HTMLElement, computed: CSSStyleDeclaration): boolean {
  const rawOpacity = computed.opacity || el.style.opacity;
  const opacity = parseFloat(rawOpacity);
  const visibility = computed.visibility || el.style.visibility;
  if (opacity < 0.1 || visibility === 'hidden') return true;

  const bg = (computed.backgroundColor || el.style.backgroundColor || '').trim().toLowerCase();
  const isBgTransparent =
    bg === '' || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' || bg === 'rgba(0,0,0,0)';
  const hasMeaningfulText = (el.textContent || '').replace(/\u00a0/g, '').trim().length > 0;
  const hasUiControls = Boolean(el.querySelector('input, form, video, button'));
  return isBgTransparent && !hasMeaningfulText && !hasUiControls;
}

function isCoveringVideoPlayer(el: HTMLElement, rect: DOMRect, doc: Document): boolean {
  const playerRoot = el.closest(
    '.jwplayer, .video-js, .plyr, .art-video-player, [class*="player"], [id*="player"]'
  );
  const video = playerRoot?.querySelector('video') ?? doc.querySelector('video');
  if (!video) return false;

  const vRect = video.getBoundingClientRect();
  if (vRect.width <= 0 || vRect.height <= 0) return false;
  return rect.width >= vRect.width * 0.7 && rect.height >= vRect.height * 0.7;
}

const PLAYER_UI_CONTROL_CLASS_REGEX =
  /\b(?:jw-controls|jw-icon|jw-slider|vjs-control|plyr__control|art-control|art-bottom)\b/i;

function isOfficialPlayerControl(el: HTMLElement): boolean {
  if (el.tagName === 'VIDEO' || el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
    return true;
  }
  const role = el.getAttribute?.('role');
  if (role === 'button' || role === 'slider') return true;
  const cls = typeof el.className === 'string' ? el.className : '';
  return PLAYER_UI_CONTROL_CLASS_REGEX.test(cls);
}

export function isCoveringScreen(el: HTMLElement, win: Window = window): boolean {
  if (!el || el === win.document.body || el === win.document.documentElement) {
    return false;
  }
  if (isOfficialPlayerControl(el)) {
    return false;
  }

  const rect = el.getBoundingClientRect();
  const coversViewport =
    rect.width >= win.innerWidth * 0.7 && rect.height >= win.innerHeight * 0.7;
  const coversPlayer = isCoveringVideoPlayer(el, rect, win.document);
  if (!coversViewport && !coversPlayer) {
    return false;
  }

  const computed = win.getComputedStyle(el);
  const position = computed.position || el.style.position;
  const isPositioned = position === 'fixed' || position === 'absolute';
  if (!isPositioned) return false;

  const rawZIndex = computed.zIndex || el.style.zIndex;
  const zIndex = parseInt(rawZIndex, 10);
  const hasHighZIndex = !isNaN(zIndex) && zIndex >= 10;
  if (!hasHighZIndex) return false;

  return isTransparentClickCatcher(el, computed);
}

export function installClickHijackGuard(
  doc: Document = document,
  options: ClickHijackOptions = {}
): () => void {
  const win = doc.defaultView || window;
  const handler = (e: MouseEvent | PointerEvent) => {
    const startTarget = e.target as HTMLElement | null;
    if (!startTarget) return;

    let cursor: HTMLElement | null = startTarget;
    for (let hop = 0; hop < 4 && cursor; hop++) {
      if (isCoveringScreen(cursor, win)) {
        e.preventDefault();
        e.stopImmediatePropagation();

        cursor.style.pointerEvents = 'none';
        cursor.remove();

        options.onNeutralized?.(cursor);
        return;
      }
      cursor = cursor.parentElement;
    }
  };

  doc.addEventListener('click', handler, { capture: true });
  doc.addEventListener('pointerdown', handler, { capture: true });

  return () => {
    doc.removeEventListener('click', handler, { capture: true });
    doc.removeEventListener('pointerdown', handler, { capture: true });
  };
}
