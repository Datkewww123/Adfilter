import { readdirSync, readFileSync } from 'node:fs';
import { runDetector } from '../src/core/detector';
import { isFixture, labelIntervals } from '../src/core/fixture';
import {
  add,
  compare,
  detectedIntervals,
  emptyCounts,
  median,
  rates,
} from '../src/core/metrics';

const DIR = 'tests/fixtures/frames';

function flag(name: string): number | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : undefined;
}

const fmt = (x: number | null): string => (x === null ? '-' : x.toFixed(3));

let total = emptyCounts();
const rows: Record<string, unknown>[] = [];

for (const name of readdirSync(DIR).filter((n) => n.endsWith('.json'))) {
  const data: unknown = JSON.parse(readFileSync(`${DIR}/${name}`, 'utf8'));
  if (!isFixture(data)) {
    console.error(`${name}: sai định dạng fixture`);
    process.exit(1);
  }
  const frames = data.frames;
  const lastT = frames[frames.length - 1]?.t ?? 0;
  const c = compare(
    labelIntervals(frames),
    detectedIntervals(runDetector(frames), lastT),
  );
  total = add(total, c);
  rows.push({
    file: name,
    tp: c.tp,
    fp: c.fp,
    fn: c.fn,
    merged: c.merged,
    debounceMs: median(c.latencies) ?? '-',
  });
}

console.table(rows);

const r = rates(total);
console.table({
  total: {
    tp: total.tp,
    fp: total.fp,
    fn: total.fn,
    merged: total.merged,
    precision: fmt(r.precision),
    recall: fmt(r.recall),
    f1: fmt(r.f1),
    debounceMs: median(total.latencies) ?? '-',
    vsLabelMs: median(total.labelLags) ?? '-',
  },
});

const minP = flag('min-precision');
const minR = flag('min-recall');
const failP = minP !== undefined && (r.precision ?? 0) < minP;
const failR = minR !== undefined && (r.recall ?? 0) < minR;

if (failP || failR) {
  console.error('Không đạt ngưỡng chất lượng đã đặt');
  process.exit(1);
}