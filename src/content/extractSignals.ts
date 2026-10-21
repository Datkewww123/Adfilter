import { AD_CLASSES, SEL } from './selectors';
import type { Signals } from '../core/types';

const isVisible = (el: Element | null): boolean => !!el && el.getClientRects().length > 0;

export function extractSignals(doc: Document, t: number): Signals {
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
  };
}