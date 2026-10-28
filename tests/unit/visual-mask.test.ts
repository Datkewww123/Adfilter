import { describe, expect, it } from 'vitest';
import { applyMask, removeMask } from '../../src/stealth/visual-mask';

describe('visual-mask: giao diện hàm kiểm soát', () => {
  it('hàm applyMask và removeMask được định nghĩa hợp lệ', () => {
    expect(typeof applyMask).toBe('function');
    expect(typeof removeMask).toBe('function');
  });
});