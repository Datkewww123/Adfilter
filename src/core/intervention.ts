import type { Config } from '../storage/config';

export type Action =
  | { type: 'CLICK_SKIP' }
  | { type: 'MUTE_SPEEDUP'; speed: number }
  | { type: 'SEEK_TO_END' };

export type ActionType = Action['type'];

export interface PlanContext {
  inAd: boolean;
  msIntoAd: number;
  skipVisible: boolean;
  done: ActionType[];
}

export const SEEK_AFTER_MS = 1500;

export function plan(ctx: PlanContext, cfg: Config): Action[] {
  if (!cfg.enabled || !ctx.inAd) return [];
  const has = (t: ActionType): boolean => ctx.done.includes(t);

  const out: Action[] = [];

  if (ctx.skipVisible) {
    if (!has('CLICK_SKIP')) {
      out.push({ type: 'CLICK_SKIP' });
    }
    if (cfg.allowSeek && !has('SEEK_TO_END')) {
      out.push({ type: 'SEEK_TO_END' });
    }
  } else {
    if (!has('MUTE_SPEEDUP')) {
      out.push({ type: 'MUTE_SPEEDUP', speed: cfg.maxSpeed });
    }
    if (cfg.allowSeek && ctx.msIntoAd >= SEEK_AFTER_MS && !has('SEEK_TO_END')) {
      out.push({ type: 'SEEK_TO_END' });
    }
  }

  return out;
}
