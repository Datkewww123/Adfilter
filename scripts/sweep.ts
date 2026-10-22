import { readdirSync, readFileSync } from 'node:fs';
import { runDetector } from '../src/core/detector';
import { isFixture, labelIntervals, type Fixture } from '../src/core/fixture';
import {
  add,
  compare,
  detectedIntervals,
  emptyCounts,
  median,
  rates,
} from '../src/core/metrics';

const DIR = 'tests/fixtures/frames';
const fmt = (x: number | null): string => (x === null ? '-' : x.toFixed(3));

const fixtures: Fixture[] = [];
for (const name of readdirSync(DIR).filter((n) => n.endsWith('.json'))) {
  const data: unknown = JSON.parse(readFileSync(`${DIR}/${name}`, 'utf8'));
  if (isFixture(data)) fixtures.push(data);
}

const rows: Record<string, unknown>[] = [];
for (const startDebounceMs of [0, 50, 100, 150, 250, 400]) {
  for (const endDebounceMs of [200, 400, 800, 1500]) {
    let total = emptyCounts();
    for (const fx of fixtures) {
      const lastT = fx.frames[fx.frames.length - 1]?.t ?? 0;
      const events = runDetector(fx.frames, { startDebounceMs, endDebounceMs });
      total = add(
        total,
        compare(labelIntervals(fx.frames), detectedIntervals(events, lastT)),
      );
    }
    const r = rates(total);
    rows.push({
      start: startDebounceMs,
      end: endDebounceMs,
      precision: fmt(r.precision),
      recall: fmt(r.recall),
      fp: total.fp,
      fn: total.fn,
      merged: total.merged,
      debounceMs: median(total.latencies) ?? '-',
    });
  }
}

console.table(rows);