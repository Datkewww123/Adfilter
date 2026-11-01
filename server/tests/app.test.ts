import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { Store } from '../src/store';
import type { EventInput } from '../src/schema';

class MockStore implements Store {
  public healthy = true;
  public events: EventInput[] = [];

  async ping(): Promise<boolean> {
    return this.healthy;
  }

  async insertEvents(events: EventInput[]): Promise<number> {
    this.events.push(...events);
    return events.length;
  }
}

describe('Fastify App API', () => {
  it('GET /health trả về 200 khi store healthy', async () => {
    const store = new MockStore();
    const app = buildApp(store);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'healthy' });
  });

  it('POST /events lưu sự kiện thành công trả về 202', async () => {
    const store = new MockStore();
    const app = buildApp(store);
    const payload = [
      {
        clientId: '3b241101-e2bb-4255-8caf-4136c566a962',
        browser: 'Chrome/130',
        version: '0.1.0',
        type: 'AD_START',
        ts: Date.now(),
      },
    ];

    const res = await app.inject({ method: 'POST', url: '/events', payload });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: 1 });
  });
});