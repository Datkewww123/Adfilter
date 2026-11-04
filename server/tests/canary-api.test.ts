import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { Store } from '../src/store';

const store: Store = {
  ping: async () => true,
  insertEvents: async (e) => e.length,
};

describe('POST /canary endpoint', () => {
  it('trả 202 khi canary ok', async () => {
    const app = buildApp(store);
    const res = await app.inject({
      method: 'POST',
      url: '/canary',
      payload: { ok: true, missing: [], ts: 1700000000000 },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: true });
  });

  it('trả 202 khi canary failed với missing hợp lệ', async () => {
    const app = buildApp(store);
    const res = await app.inject({
      method: 'POST',
      url: '/canary',
      payload: { ok: false, missing: ['video'], ts: 1700000000000 },
    });
    expect(res.statusCode).toBe(202);
  });

  it('trả 400 khi missing chứa phần tử không hợp lệ', async () => {
    const app = buildApp(store);
    const res = await app.inject({
      method: 'POST',
      url: '/canary',
      payload: { ok: false, missing: ['https://x'], ts: 1700000000000 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('trả 400 khi có trường lạ', async () => {
    const app = buildApp(store);
    const res = await app.inject({
      method: 'POST',
      url: '/canary',
      payload: { ok: true, missing: [], ts: 1700000000000, extra: 'field' },
    });
    expect(res.statusCode).toBe(400);
  });
});
