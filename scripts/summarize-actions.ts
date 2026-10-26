import { readFileSync } from 'node:fs';
import type { ActionRecord } from '../src/core/actionRecord';
import { summarizeActions } from '../src/core/stats';

const file = process.argv[2];
if (!file) {
  console.error('Cách dùng: pnpm summarize tmp/actions.json');
  process.exit(1);
}

const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(data)) {
  throw new Error('File phải là mảng JSON');
}

const s = summarizeActions(data as ActionRecord[]);
console.table({
  ...s,
  byAction: JSON.stringify(s.byAction),
  successRate: s.successRate === null ? '-' : s.successRate.toFixed(3),
});