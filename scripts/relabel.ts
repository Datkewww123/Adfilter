import { readFileSync, writeFileSync } from 'node:fs';
import { isFixture } from '../src/core/fixture';

const [file, ...rest] = process.argv.slice(2);
const nums = rest.map(Number);

if (!file || nums.length === 0 || nums.length % 2 !== 0 || nums.some(Number.isNaN)) {
  console.error('Cách dùng: pnpm relabel <file> <startMs> <endMs> [<startMs> <endMs> ...]');
  process.exit(1);
}

const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
if (!isFixture(data)) throw new Error('Sai định dạng fixture');

const t0 = data.frames[0]?.t ?? 0;
const ranges: Array<[number, number]> = [];
for (let i = 0; i < nums.length; i += 2) ranges.push([nums[i] ?? 0, nums[i + 1] ?? 0]);

for (const f of data.frames) {
  const rel = f.t - t0;
  f.label = ranges.some(([a, b]) => rel >= a && rel <= b);
}

writeFileSync(file, JSON.stringify(data));
console.log('đã gán nhãn lại:', file, ranges.map(([a, b]) => `${a}-${b}ms`).join(', '));