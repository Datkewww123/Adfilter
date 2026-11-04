/**
 * Chaos Drill #1: Giả lập YouTube thay đổi cấu trúc Player
 * Chạy: pnpm tsx scripts/drill-broken-dom.ts
 */
async function runDrill(): Promise<void> {
  const API_URL = process.env.API_URL || 'http://localhost:3000';

  console.log('🚨 [CHAOS DRILL 1] Bắt đầu giả lập YouTube đổi cấu trúc...');
  console.log(`Gửi báo cáo canary hỏng về: ${API_URL}/canary`);

  const startTime = Date.now();

  const response = await fetch(`${API_URL}/canary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: false,
      missing: ['video'],
      ts: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`API trả lỗi HTTP ${response.status}`);
  }

  console.log('✅ Đã gửi tín hiệu canary hỏng thành công.');
  console.log('Đang quan sát /metrics để xác nhận thời gian Grafana bắn alert về /alert-hook...');

  let triggered = false;
  while (Date.now() - startTime < 60_000) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const metricRes = await fetch(`${API_URL}/metrics`);
      const text = await metricRes.text();

      if (text.includes('adfilter_alert_webhooks_total')) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`🎉 [THÀNH CÔNG] Webhook cảnh báo đã bắn về Server sau ${elapsed}s (MTTD)!`);
        triggered = true;
        break;
      }
    } catch {}
    process.stdout.write('.');
  }

  if (!triggered) {
    console.log('\n⚠️ Chưa nhận webhook trong 60s (hãy đảm bảo Docker Compose Grafana + Prometheus đang chạy).');
  }
}

runDrill().catch((err) => {
  console.error('Lỗi diễn tập:', err);
  process.exit(1);
});