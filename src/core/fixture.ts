import type { Signals } from './types';

export interface FixtureMeta {
  schema: 1;
  recordedAt: string; // ISO 8601
  browser: string;
  note: string;
}

export interface Fixture {
  meta: FixtureMeta;
  frames: Signals[];
}

export interface Interval {
  start: number;
  end: number;
}

export function buildFixture(frames: Signals[], meta: Omit<FixtureMeta, 'schema'>): Fixture {
  return { meta: { ...meta, schema: 1 }, frames };
}

export function isFixture(x: unknown): x is Fixture {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as { meta?: { schema?: unknown }; frames?: unknown };
  if (o.meta?.schema !== 1 || !Array.isArray(o.frames)) return false;
  return o.frames.every((f) => {
    const fr = f as Partial<Signals> | null;
    return (
      typeof fr === 'object' &&
      fr !== null &&
      typeof fr.t === 'number' &&
      typeof fr.playerFound === 'boolean' &&
      typeof fr.adShowing === 'boolean'
    );
  });
}

/** Gom các frame liền nhau thỏa điều kiện thành các khoảng [start, end] theo thời gian t */
export function intervalsOf(frames: Signals[], pred: (f: Signals) => boolean): Interval[] {
  const out: Interval[] = [];
  let cur: Interval | null = null;
  for (const f of frames) {
    if (pred(f)) {
      if (cur) cur.end = f.t;
      else cur = { start: f.t, end: f.t };
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export const labelIntervals = (frames: Signals[]): Interval[] =>
  intervalsOf(frames, (f) => !!f.label);