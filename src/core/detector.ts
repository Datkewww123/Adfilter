import type { AdPhase, Signals } from './types';

export interface DetectorState {
  phase: AdPhase;
  pendingSince: number | null;
}

export interface DetectorEvent {
  type: 'AD_START' | 'AD_END';
  at: number; // lúc tín hiệu bắt đầu ổn định (lùi về quá khứ)
  emittedAt: number; // lúc detector thực sự nhận ra
}

export const START_DEBOUNCE_MS = 150;
export const END_DEBOUNCE_MS = 400;

export const initialState: DetectorState = {
  phase: 'UNKNOWN',
  pendingSince: null,
};

export const score = (s: Signals): number =>
  (s.adShowing ? 3 : 0) + (s.adOverlay ? 2 : 0) + (s.adBadge ? 1 : 0);

export const looksLikeAd = (s: Signals): boolean => s.playerFound && score(s) >= 3;

/** Theo dõi một điều kiện có kéo dài đủ lâu chưa. */
function confirm(pendingSince: number | null, now: number, active: boolean, ms: number) {
  if (!active) return { pendingSince: null, confirmed: false, since: now };
  const since = pendingSince ?? now;
  return { pendingSince: since, confirmed: now - since >= ms, since };
}

export function step(
  prev: DetectorState,
  s: Signals,
): { next: DetectorState; events: DetectorEvent[] } {
  const ad = looksLikeAd(s);

  switch (prev.phase) {
    case 'UNKNOWN': {
      if (!s.playerFound) return { next: prev, events: [] };
      if (ad) {
        return {
          next: { phase: 'AD', pendingSince: null },
          events: [{ type: 'AD_START', at: s.t, emittedAt: s.t }],
        };
      }
      return { next: { phase: 'NORMAL', pendingSince: null }, events: [] };
    }

    case 'NORMAL': {
      const c = confirm(prev.pendingSince, s.t, ad, START_DEBOUNCE_MS);
      if (c.confirmed) {
        return {
          next: { phase: 'AD', pendingSince: null },
          events: [{ type: 'AD_START', at: c.since, emittedAt: s.t }],
        };
      }
      return { next: { phase: 'NORMAL', pendingSince: c.pendingSince }, events: [] };
    }

    case 'AD': {
      const c = confirm(prev.pendingSince, s.t, !ad, END_DEBOUNCE_MS);
      if (c.confirmed) {
        return {
          next: { phase: 'NORMAL', pendingSince: null },
          events: [{ type: 'AD_END', at: c.since, emittedAt: s.t }],
        };
      }
      return { next: { phase: 'AD', pendingSince: c.pendingSince }, events: [] };
    }
  }
}

/** Chạy detector qua một chuỗi frame, dùng cho test và script đo. */
export function runDetector(frames: Signals[]): DetectorEvent[] {
  let state = initialState;
  const out: DetectorEvent[] = [];
  for (const f of frames) {
    const r = step(state, f);
    state = r.next;
    out.push(...r.events);
  }
  return out;
}