import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isFixture } from '../../src/core/fixture';

const DIR = 'tests/fixtures/frames';
const files = readdirSync(DIR).filter((n) => n.endsWith('.json'));

describe('fixtures', () => {
  it('có ít nhất một fixture', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s hợp lệ', (name) => {
    const data: unknown = JSON.parse(readFileSync(`${DIR}/${name}`, 'utf8'));
    expect(isFixture(data)).toBe(true);
  });
});