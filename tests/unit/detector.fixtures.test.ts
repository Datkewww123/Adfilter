import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runDetector } from '../../src/core/detector';
import { isFixture } from '../../src/core/fixture';

const DIR = 'tests/fixtures/frames';
const files = readdirSync(DIR).filter((n) => n.endsWith('.json'));

describe.each(files)('detector trên %s', (name) => {
  const data: unknown = JSON.parse(readFileSync(`${DIR}/${name}`, 'utf8'));
  if (!isFixture(data)) throw new Error(`${name} không hợp lệ`);
  const events = runDetector(data.frames);

  it('sự kiện xen kẽ START rồi END, không bắt đầu bằng END', () => {
    events.forEach((e, i) => expect(e.type).toBe(i % 2 === 0 ? 'AD_START' : 'AD_END'));
  });

  it('at không muộn hơn emittedAt', () => {
    for (const e of events) expect(e.at).toBeLessThanOrEqual(e.emittedAt);
  });
});