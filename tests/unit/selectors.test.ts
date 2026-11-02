import { describe, expect, it } from 'vitest';
import { SELECTORS_DESKTOP, SELECTORS_MOBILE, selectorsFor } from '../../src/content/selectors';

describe('selectorsFor', () => {
  it('m.youtube.com dùng bộ di động', () => {
    expect(selectorsFor('m.youtube.com')).toBe(SELECTORS_MOBILE);
  });

  it.each(['www.youtube.com', 'localhost', ''])('%j dùng bộ máy tính', (host) => {
    expect(selectorsFor(host)).toBe(SELECTORS_DESKTOP);
  });

  it.each([SELECTORS_DESKTOP, SELECTORS_MOBILE])('không có selector rỗng', (set) => {
    for (const value of Object.values(set)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});