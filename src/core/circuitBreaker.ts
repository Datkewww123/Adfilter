export interface Breaker {
  failures: number[];
  openUntil: number;
}

export interface BreakerConfig {
  maxFailures: number;
  windowMs: number;
  cooldownMs: number;
}

export const DEFAULT_BREAKER: BreakerConfig = {
  maxFailures: 3,
  windowMs: 600_000, // 10 phút
  cooldownMs: 1_800_000, // 30 phút
};

export const emptyBreaker = (): Breaker => ({ failures: [], openUntil: 0 });

export const canAct = (b: Breaker, now: number): boolean => now >= b.openUntil;

export function recordFailure(
  b: Breaker,
  now: number,
  cfg: BreakerConfig = DEFAULT_BREAKER,
): Breaker {
  const failures = [...b.failures.filter((t) => now - t < cfg.windowMs), now];
  if (failures.length >= cfg.maxFailures) {
    return { failures: [], openUntil: now + cfg.cooldownMs };
  }
  return { failures, openUntil: b.openUntil };
}

/** Mở mạch ngay lập tức, ví dụ khi thấy cảnh báo của trang. */
export const trip = (now: number, cfg: BreakerConfig = DEFAULT_BREAKER): Breaker => ({
  failures: [],
  openUntil: now + cfg.cooldownMs,
});
export function normalizeBreaker(raw: unknown): Breaker {
  const r = typeof raw === 'object' && raw !== null ? (raw as Partial<Breaker>) : {};
  const failures = Array.isArray(r.failures)
    ? r.failures.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
    : [];
  const openUntil = typeof r.openUntil === 'number' && Number.isFinite(r.openUntil) ? r.openUntil : 0;
  return { failures, openUntil };
}