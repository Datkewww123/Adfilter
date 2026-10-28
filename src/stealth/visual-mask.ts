/**
 * Visual Mask — Lớp bảo vệ bọc lót.
 * Che màn hình đen + tắt tiếng tức thời (< 50ms) nếu quảng cáo lọt qua.
 */

const MASK_ID = '__adfilter_visual_mask';
let originalVolume = 1;
let maskActive = false;

export function applyMask(): void {
  if (maskActive) return;
  maskActive = true;

  const video = document.querySelector<HTMLVideoElement>('video.html5-main-video');
  if (video) {
    originalVolume = video.volume;
    video.volume = 0;
    video.muted = true;
  }

  let mask = document.getElementById(MASK_ID);
  if (!mask) {
    mask = document.createElement('div');
    mask.id = MASK_ID;
    Object.assign(mask.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: '#0f0f0f',
      zIndex: '9999',
      pointerEvents: 'none',
    });
    const player = document.querySelector('#movie_player');
    if (player) {
      (player as HTMLElement).style.position = 'relative';
      player.appendChild(mask);
    }
  }
  mask.style.display = 'block';

  if (video && Number.isFinite(video.duration) && video.duration > 0) {
    video.currentTime = Math.max(0, video.duration - 0.1);
    video.playbackRate = 16;
    if (video.paused) void video.play().catch(() => undefined);
  }
}

export function removeMask(): void {
  if (!maskActive) return;
  maskActive = false;

  const mask = document.getElementById(MASK_ID);
  if (mask) mask.style.display = 'none';

  const video = document.querySelector<HTMLVideoElement>('video.html5-main-video');
  if (video) {
    video.volume = originalVolume;
    video.muted = false;
    video.playbackRate = 1;
  }
}