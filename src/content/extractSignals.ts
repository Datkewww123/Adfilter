import { AD_CLASSES, ENFORCEMENT_SELECTORS, getActiveVideo, getSkipButton, SEL } from './selectors';
import type { Signals } from '../core/types';

export function extractSignals(
  doc: Document,
  t: number,
  enforcementSelectors: readonly string[] = ENFORCEMENT_SELECTORS,
): Signals {
  const player = doc.querySelector(SEL.player);
  const video = getActiveVideo(doc);
  const skipBtn = getSkipButton(doc);

  return {
    t,
    playerFound: !!player,
    adShowing: !!player && AD_CLASSES.some((c) => player.classList.contains(c)),
    adOverlay: !!doc.querySelector(SEL.adOverlay),
    adBadge: !!doc.querySelector(SEL.adBadge),
    skipVisible: !!skipBtn,
    duration: video && Number.isFinite(video.duration) ? video.duration : null,
    currentTime: video ? video.currentTime : null,
    paused: video ? video.paused : null,
    muted: video ? video.muted : null,
    playbackRate: video ? video.playbackRate : null,
    enforcement: enforcementSelectors.some((s) => doc.querySelector(s) !== null),
    adBadgeText: doc.querySelector(SEL.adBadge)?.textContent?.trim() ?? null,
  };
}
