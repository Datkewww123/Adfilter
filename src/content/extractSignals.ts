import { AD_CLASSES, ENFORCEMENT_SELECTORS, SEL } from './selectors';
import type { Signals } from '../core/types';

const isVisible = (el: Element | null): boolean => !!el && el.getClientRects().length > 0;

export function extractSignals(
  doc: Document,
  t: number,
  enforcementSelectors: readonly string[] = ENFORCEMENT_SELECTORS,
): Signals {
  const player = doc.querySelector(SEL.player);
  const video = doc.querySelector<HTMLVideoElement>(SEL.video);
  return {
    t,
    playerFound: !!player,
    adShowing: !!player && AD_CLASSES.some((c) => player.classList.contains(c)),
    adOverlay: !!doc.querySelector(SEL.adOverlay),
    adBadge: !!doc.querySelector(SEL.adBadge),
    skipVisible: isVisible(doc.querySelector(SEL.skipButton)),
    duration: video && Number.isFinite(video.duration) ? video.duration : null,
    currentTime: video ? video.currentTime : null,
    paused: video ? video.paused : null,
    muted: video ? video.muted : null,
    playbackRate: video ? video.playbackRate : null,
    enforcement: enforcementSelectors.some((s) => doc.querySelector(s) !== null),
  };
}