import { describe, it, expect } from 'vitest';
import type { AdPhase } from '../../src/core/types';

describe('Smoke Test - Môi trường kiểm thử', () => {
  it('toán tử cơ bản hoạt động đúng', () => {
    expect(1 + 1).toBe(2);
  });

  it('kiểu dữ liệu AdPhase hợp lệ', () => {
    const phase: AdPhase = 'NORMAL';
    expect(phase).toBe('NORMAL');
  });
});