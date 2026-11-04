/**
 * Chaos Drill #2: Giả lập Circuit Breaker mở do lỗi liên tiếp
 * Chạy: pnpm tsx scripts/drill-circuit-breaker.ts
 */
async function runCircuitBreakerDrill(): Promise<void> {
  const API_URL = process.env.API_URL || 'http://localhost:3000';

  console.log('🚨 [CHAOS DRILL 2] Gửi 3 sự kiện can thiệp thất bại liên tiếp...');

  const payload = [
    {
      type: 'INTERVENTION',
      browser: 'Chrome/124.0',
      strategy: 'SKIP_BUTTON',
      ok: false,
      ts: Date.now(),
    },
    {
      type: 'INTERVENTION',
      browser: 'Chrome/124.0',
      strategy: 'SPEED_UP',
      ok: false,
      ts: Date.now(),
    },
    {
      type: 'INTERVENTION',
      browser: 'Chrome/124.0',
      strategy: 'VISUAL_MASK',
      ok: false,
      ts: Date.now(),
    },
  ];

  const res = await fetch(`${API_URL}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log(`Kết quả gửi events: HTTP ${res.status}`);
  console.log('✅ Hoàn tất diễn tập circuit breaker trip.');
}

runCircuitBreakerDrill().catch(console.error);