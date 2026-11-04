import client from 'prom-client';
import type { EventInput } from './schema';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const eventsTotal = new client.Counter({
  name: 'adfilter_events_total',
  help: 'Tổng số sự kiện telemetry nhận được theo loại',
  labelNames: ['type', 'browser'],
  registers: [register],
});

export const interventionsTotal = new client.Counter({
  name: 'adfilter_interventions_total',
  help: 'Tổng số lần can thiệp quảng cáo',
  labelNames: ['strategy', 'ok'],
  registers: [register],
});

export const canaryOk = new client.Gauge({
  name: 'adfilter_canary_ok',
  help: '1 nếu lần canary gần nhất thấy đủ cấu trúc, 0 nếu thiếu',
  registers: [register],
});

export const canaryLast = new client.Gauge({
  name: 'adfilter_canary_last_run_timestamp_seconds',
  help: 'Thời điểm chạy canary gần nhất',
  registers: [register],
});

export function recordEventMetrics(events: EventInput[]): void {
  for (const e of events) {
    eventsTotal.inc({ type: e.type, browser: e.browser.split('/')[0] || 'Unknown' });
    if (e.type === 'INTERVENTION' && e.strategy) {
      interventionsTotal.inc({ strategy: e.strategy, ok: String(e.ok ?? false) });
    }
  }
}
export function recordCanary(ok: boolean): void {
  canaryOk.set(ok ? 1 : 0);
  canaryLast.set(Date.now() / 1000);
}
