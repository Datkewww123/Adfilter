export const SEL = {
  player: '#movie_player',
  video: 'video.html5-main-video',
  adOverlay: '.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout',
  skipButton:
    '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-slot button, .ytp-skip-ad-button-slot button, [id*="skip-button"], .ytp-ad-skip-button-container button, button.ytp-ad-button-vm',
  adBadge: '.ytp-ad-simple-ad-badge, .ytp-ad-text',
} as const;

export const AD_CLASSES = ['ad-showing', 'ad-interrupting'] as const;
export const ENFORCEMENT_SELECTORS: readonly string[] = [];

/** Tìm thẻ video đang thực sự phát (hỗ trợ nhiều thẻ video trong Ad Pod 1 of 3, 2 of 3) */
export function getActiveVideo(doc: Document): HTMLVideoElement | null {
  const player = doc.querySelector(SEL.player);
  const videos = Array.from((player || doc).querySelectorAll<HTMLVideoElement>('video'));
  if (videos.length === 0) return null;
  if (videos.length === 1) return videos[0];

  // 1. Ưu tiên video đang phát (không bị paused) và có duration hữu hạn > 0
  const playing = videos.find((v) => !v.paused && Number.isFinite(v.duration) && v.duration > 0);
  if (playing) return playing;

  // 2. Video có duration hữu hạn > 0
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

  const candidates = doc.querySelectorAll<HTMLElement>(SEL.skipButton);
  for (const el of candidates) {
    // 1. Chỉ loại trừ các nút cài đặt app / liên kết trang của nhà tài trợ
    if (
      el.closest(
        '.ytp-ad-avatar-lockup-card, .ytp-ad-visit-advertiser-button',
      )
    ) {
      continue;
    }

    // 2. Không được là nút bị vô hiệu hóa
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
      continue;
    }

    // 3. Nhận diện chữ "Skip" / "Bỏ qua" hoặc class skip đặc thù của YouTube
    const text = (el.textContent || '').trim().toLowerCase();
    const isSkipWord = text.includes('skip') || text.includes('bỏ qua');
    const isSkipClass =
      el.classList.contains('ytp-skip-ad-button') ||
      el.classList.contains('ytp-ad-skip-button') ||
      el.classList.contains('ytp-ad-skip-button-modern') ||
      el.closest('.ytp-ad-skip-button-slot, .ytp-skip-ad-button-slot') !== null;

    // Nếu chỉ là số đếm ngược đơn thuần (5, 4, 3, 2, 1) mà chưa có chữ Skip thì chưa được bấm
    const isCountdownOnly = /^\d+$/.test(text);
    if (isCountdownOnly) continue;

    const isVisible = el.getClientRects().length > 0 || el.offsetWidth > 0 || el.offsetHeight > 0;
    if ((isSkipWord || isSkipClass) && isVisible) {
      return el;
    }
  }

  // Fallback: Tìm bất kỳ button nào trong player có chữ Skip
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
