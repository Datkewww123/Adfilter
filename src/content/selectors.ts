export interface Selectors {
  player: string;
  video: string;
  adOverlay: string;
  skipButton: string;
  adBadge: string;
}

export const SELECTORS_DESKTOP: Selectors = {
  player: '#movie_player',
  video: 'video.html5-main-video',
  adOverlay: '.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout',
  skipButton:
    '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-slot button, .ytp-skip-ad-button-slot button, .ytp-ad-skip-button-container button, button.ytp-ad-button-vm',
  adBadge: '.ytp-ad-simple-ad-badge, .ytp-ad-text',
};

// Cấu hình selector cho YouTube Mobile (m.youtube.com)
export const SELECTORS_MOBILE: Selectors = {
  player: '#player-container-id, .player-container, #movie_player',
  video: 'video.video-stream, video',
  adOverlay: '.ad-container, .ytm-ad-overlay, .ytp-ad-player-overlay',
  skipButton:
    '.ytm-skip-ad-button, .videoAdUiSkipButton, .ytp-skip-ad-button, .ytp-ad-skip-button',
  adBadge: '.ad-interrupting, .ytp-ad-badge, .ytm-ad-badge',
};

export function selectorsFor(hostname: string): Selectors {
  return hostname === 'm.youtube.com' ? SELECTORS_MOBILE : SELECTORS_DESKTOP;
}

export const SEL: Selectors = selectorsFor(typeof location !== 'undefined' ? location.hostname : '');

export const AD_CLASSES = ['ad-showing', 'ad-interrupting'] as const;
declare const __E2E__: boolean | undefined;
const E2E = typeof __E2E__ !== 'undefined' && __E2E__ === true;
export const ENFORCEMENT_SELECTORS: readonly string[] = E2E ? ['#adblock-warning'] : [];

/** Tìm thẻ video đang thực sự phát (hỗ trợ cả Desktop lẫn Mobile) */
export function getActiveVideo(doc: Document): HTMLVideoElement | null {
  const player = doc.querySelector(SEL.player);
  const videos = Array.from((player || doc).querySelectorAll<HTMLVideoElement>('video'));
  if (videos.length === 0) return null;
  if (videos.length === 1) return videos[0];

  const playing = videos.find((v) => !v.paused && Number.isFinite(v.duration) && v.duration > 0);
  if (playing) return playing;

  const withDuration = videos.find((v) => Number.isFinite(v.duration) && v.duration > 0);
  if (withDuration) return withDuration;

  return videos[0];
}

/** Tìm chính xác nút Bỏ qua quảng cáo (Skip Ad) KHI ĐÃ SẴN SÀNG CLICK */
export function getSkipButton(doc: Document): HTMLElement | null {
  const player = doc.querySelector(SEL.player);
  if (!player || !AD_CLASSES.some((c) => player.classList.contains(c))) {
    return null;
  }

  const candidates = player.querySelectorAll<HTMLElement>(SEL.skipButton);
  for (const el of candidates) {
    if (el.closest('.ytp-ad-avatar-lockup-card, .ytp-ad-visit-advertiser-button')) {
      continue;
    }
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
      continue;
    }

    const text = (el.textContent || '').trim().toLowerCase();
    const isSkipWord = text.includes('skip') || text.includes('bỏ qua');
    const isSkipClass =
      el.classList.contains('ytp-skip-ad-button') ||
      el.classList.contains('ytp-ad-skip-button') ||
      el.classList.contains('ytm-skip-ad-button') ||
      el.closest('.ytp-ad-skip-button-slot, .ytp-skip-ad-button-slot') !== null;

    const isCountdownOnly = /^\d+$/.test(text);
    if (isCountdownOnly) continue;

    const isVisible = el.getClientRects().length > 0 || el.offsetWidth > 0 || el.offsetHeight > 0;
    if ((isSkipWord || isSkipClass) && isVisible) {
      return el;
    }
  }

  const buttons = player.querySelectorAll<HTMLElement>('button, [role="button"]');
  for (const b of buttons) {
    if (b.closest('.ytp-ad-avatar-lockup-card, .ytp-ad-visit-advertiser-button')) continue;
    const text = (b.textContent || '').trim().toLowerCase();
    if (
      (text.includes('skip') || text.includes('bỏ qua')) &&
      (b.getClientRects().length > 0 || b.offsetWidth > 0)
    ) {
      return b;
    }
  }

  return null;
}