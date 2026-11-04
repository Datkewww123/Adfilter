import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../src/app';
import { register, canaryOk, canaryLast, alertWebhooksTotal } from '../src/metrics';
import type { Store } from '../src/store';

const mockStore: Store = {
  ping: async () => true,
  insertEvents: async () => 1,
};

describe('Canary & Alert Webhook API', () => {
  beforeEach(() => {
    canaryOk.set(0);
    canaryLast.set(0);
    alertWebhooksTotal.reset();
  });

  it('nhận payload canary hợp lệ và cập nhật metrics', async () => {
    const app = buildApp(mockStore);
    const res = await app.inject({
      method: 'POST',
      url: '/canary',
      payload: {
        ok: true,
        missing: [],
        ts: Date.now(),
      },
    });

    expect(res.statusCode).toBe(202);
    expect(JSON.parse(res.body)).toEqual({ accepted: true });

    const metricsText = await register.metrics();
    expect(metricsText).toContain('adfilter_canary_ok 1');
  });

  it('từ chối canary có trường lạ hoặc giá trị không đúng', async () => {
    const app = buildApp(mockStore);
    const res = await app.inject({
      method: 'POST',
      url: '/canary',
      payload: {
        ok: false,
        missing: ['invalid_element_name'],
        ts: Date.now(),
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('nhận webhook cảnh báo từ Grafana tại /alert-hook và tăng counter', async () => {
    const app = buildApp(mockStore);
    const res = await app.inject({
      method: 'POST',
      url: '/alert-hook',
      payload: {
        receiver: 'adfilter-webhook',
        status: 'firing',
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'CanaryBroken' },
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'received' });

    const metricsText = await register.metrics();
    expect(metricsText).toContain('adfilter_alert_webhooks_total{status="firing"} 1');
  });
});
