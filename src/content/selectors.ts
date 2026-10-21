export const SEL = {
  player: '#movie_player',
  video: 'video.html5-main-video',
  adOverlay: '.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout',
  skipButton: '.ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button',
  adBadge: '.ytp-ad-simple-ad-badge, .ytp-ad-text',
} as const;
export const AD_CLASSES = ['ad-showing', 'ad-interrupting'] as const;