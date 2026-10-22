import { readdirSync, readFileSync } from 'node:fs';
import { intervalsOf, isFixture, labelIntervals } from '../src/core/fixture';

const DIR = 'tests/fixtures/frames';
const detail = process.argv.includes('--detail');
let bad = 0;
const rows: Record<string, unknown>[] = [];

for (const name of readdirSync(DIR).filter((n) => n.endsWith('.json'))) {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(`${DIR}/${name}`, 'utf8'));
  } catch {
    console.error(`${name}: JSON không hợp lệ`);
    bad++;
    continue;
  }

  if (!isFixture(data)) {
    console.error(`${name}: sai định dạng fixture`);
    bad++;
    continue;
  }

  const { frames } = data;
  const first = frames[0];
  const last = frames[frames.length - 1];
  const t0 = first?.t ?? 0;
  const labeled = frames.filter((f) => f.label);
  const agree = labeled.filter((f) => f.adShowing).length;

  rows.push({
    file: name,
    frames: frames.length,
    seconds: first && last ? Math.round((last.t - first.t) / 1000) : 0,
    labeledAds: labelIntervals(frames).length,
    signalAds: intervalsOf(frames, (f) => f.adShowing).length,
    labelAgree: labeled.length ? (agree / labeled.length).toFixed(2) : 'n/a',
  });

  if (detail) {
    const rel = (iv: { start: number; end: number }) => `${iv.start - t0}-${iv.end - t0}ms`;
    const byLabel = labelIntervals(frames).map(rel).join(', ') || '-';
    const bySignal = intervalsOf(frames, (f) => f.adShowing).map(rel).join(', ') || '-';
    console.log(name, 'nhan   :', byLabel);
    console.log(name, 'tinhieu:', bySignal);
  }
}

console.table(rows);
console.log(`${rows.length} hợp lệ, ${bad} lỗi`);
if (bad > 0) process.exit(1);