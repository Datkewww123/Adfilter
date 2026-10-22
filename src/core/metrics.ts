import type { DetectorEvent } from './detector';
import type { Interval } from './fixture';

export interface DetectedInterval extends Interval {
  emittedAt: number;
}

/** Ghép cặp AD_START, AD_END thành khoảng; quảng cáo chưa kết thúc được đóng ở lastT. */
export function detectedIntervals(events: DetectorEvent[], lastT: number): DetectedInterval[] {
  const out: DetectedInterval[] = [];
  let cur: DetectedInterval | null = null;
  for (const e of events) {
    if (e.type === 'AD_START') {
      cur = { start: e.at, end: lastT, emittedAt: e.emittedAt };
    } else if (cur) {
      cur.end = e.at;
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

const overlaps = (a: Interval, b: Interval): boolean => a.start <= b.end && b.start <= a.end;

export interface Counts {
  tp: number; // phát hiện trùng với một quảng cáo thật
  fp: number; // phát hiện mà không có quảng cáo thật
  fn: number; // quảng cáo thật mà không được phát hiện
  merged: number; // số nhãn bị gộp chung vào một phát hiện
  latencies: number[]; // emittedAt trừ start: độ trễ do debounce, khách quan
  labelLags: number[]; // emittedAt trừ lúc bạn bấm nhãn
}

export const emptyCounts = (): Counts => ({
  tp: 0,
  fp: 0,
  fn: 0,
  merged: 0,
  latencies: [],
  labelLags: [],
});

export function compare(truth: Interval[], detected: DetectedInterval[]): Counts {
  const c = emptyCounts();
  for (const d of detected) {
    const hits = truth.filter((t) => overlaps(d, t));
    if (hits.length === 0) {
      c.fp++;
      continue;
    }
    c.tp++;
    c.merged += hits.length - 1;
    c.latencies.push(d.emittedAt - d.start);
    const first = hits[0];
    if (first) c.labelLags.push(d.emittedAt - first.start);
  }
  for (const t of truth) {
    if (!detected.some((d) => overlaps(d, t))) c.fn++;
  }
  return c;
}

export const add = (a: Counts, b: Counts): Counts => ({
  tp: a.tp + b.tp,
  fp: a.fp + b.fp,
  fn: a.fn + b.fn,
  merged: a.merged + b.merged,
  latencies: [...a.latencies, ...b.latencies],
  labelLags: [...a.labelLags, ...b.labelLags],
});

export function rates(c: Counts): {
  precision: number | null;
  recall: number | null;
  f1: number | null;
} {
  const precision = c.tp + c.fp === 0 ? null : c.tp / (c.tp + c.fp);
  const recall = c.tp + c.fn === 0 ? null : c.tp / (c.tp + c.fn);
  const f1 =
    precision === null || recall === null || precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid] ?? null;
  return ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}