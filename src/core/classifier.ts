import { parseCounter, type AdCounter } from './adCounter';
import type { Signals } from './types';

export type AdKind = 'SKIPPABLE' | 'NON_SKIPPABLE' | 'SEQUENCE' | 'UNKNOWN';

export interface AdObservation {
  startedAt: number;
  lastSeenAt: number;
  ended: boolean;
  skipSeen: boolean;
  maxDuration: number | null;
  counter: AdCounter | null;
}

export const newObservation = (startedAt: number): AdObservation => ({
  startedAt,
  lastSeenAt: startedAt,
  ended: false,
  skipSeen: false,
  maxDuration: null,
  counter: null,
});

export function observeAd(prev: AdObservation, s: Signals): AdObservation {
  return {
    ...prev,
    lastSeenAt: s.t,
    skipSeen: prev.skipSeen || s.skipVisible,
    maxDuration:
      s.duration !== null ? Math.max(prev.maxDuration ?? 0, s.duration) : prev.maxDuration,
    counter: parseCounter(s.adBadgeText) ?? prev.counter,
  };
}

export const endObservation = (o: AdObservation, at: number): AdObservation => ({
  ...o,
  ended: true,
  lastSeenAt: at,
});

export function classify(o: AdObservation): { kind: AdKind; confidence: number } {
  if (o.counter && o.counter.total > 1) return { kind: 'SEQUENCE', confidence: 0.9 };
  if (o.skipSeen) return { kind: 'SKIPPABLE', confidence: 0.95 };
  // Có thể là quảng cáo bỏ qua được nhưng kết thúc trước khi nút kịp hiện
  if (o.ended) return { kind: 'NON_SKIPPABLE', confidence: 0.7 };
  return { kind: 'UNKNOWN', confidence: 0.3 };
}