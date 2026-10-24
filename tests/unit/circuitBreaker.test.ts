import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BREAKER,
  canAct,
  emptyBreaker,
  recordFailure,
  trip,
} from '../../src/core/circuitBreaker';

const t0 = 1_000_000;

describe('circuit breaker', () => {
  it('mới tạo thì cho phép hành động', () => {
    expect(canAct(emptyBreaker(), t0)).toBe(true);
  });

  it('hai lỗi chưa mở mạch', () => {
    let b = recordFailure(emptyBreaker(), t0);
    b = recordFailure(b, t0 + 1000);
    expect(canAct(b, t0 + 1001)).toBe(true);
  });

  it('lỗi thứ ba trong cửa sổ thì mở và chặn đến hết khoảng nghỉ', () => {
    let b = emptyBreaker();
    b = recordFailure(b, t0);
    b = recordFailure(b, t0 + 1000);
    b = recordFailure(b, t0 + 2000);
    expect(canAct(b, t0 + 2001)).toBe(false);
    expect(canAct(b, t0 + 2000 + DEFAULT_BREAKER.cooldownMs)).toBe(true);
  });

  it('lỗi cũ ngoài cửa sổ không tính', () => {
    let b = recordFailure(emptyBreaker(), t0);
    b = recordFailure(b, t0 + 1000);
    const late = t0 + DEFAULT_BREAKER.windowMs + 5000;
    b = recordFailure(b, late);
    expect(canAct(b, late + 1)).toBe(true);
  });

  it('trip mở ngay', () => {
    const b = trip(t0);
    expect(canAct(b, t0 + 1)).toBe(false);
    expect(canAct(b, t0 + DEFAULT_BREAKER.cooldownMs)).toBe(true);
  });

  it('không sửa đối tượng đầu vào', () => {
    const b = emptyBreaker();
    recordFailure(b, t0);
    expect(b).toEqual({ failures: [], openUntil: 0 });
  });

  it('tùy chỉnh số lỗi tối đa', () => {
    const cfg = { maxFailures: 2, windowMs: 1000, cooldownMs: 5000 };
    let b = recordFailure(emptyBreaker(), t0, cfg);
    b = recordFailure(b, t0 + 100, cfg);
    expect(canAct(b, t0 + 101)).toBe(false);
  });
});