import { describe, expect, it } from 'vitest';
import {
  sanitizeEvent,
  envelop,
  enqueue,
  splitBatch,
  type Envelope,
} from '../../src/core/telemetry';

describe('telemetry pure functions', () => {
  it('sanitizeEvent loại bỏ mọi trường lạ như url và title', () => {
    const dirty = {
      type: 'AD_START',
      ts: 5,
      url: 'https://youtube.com/watch?v=123',
      title: 'Secret Video',
    } as never;
    expect(sanitizeEvent(dirty)).toEqual({ type: 'AD_START', ts: 5 });
  });

  it('loại sự kiện lạ tự động chuyển về ERROR', () => {
    const e = { type: 'UNKNOWN_TYPE', ts: 100 };
    expect(sanitizeEvent(e)).toEqual({ type: 'ERROR', ts: 100 });
  });

  it('envelop giới hạn độ dài browser và version tối đa 32 ký tự', () => {
    const env = envelop(
      { type: 'AD_START', ts: 1 },
      {
        clientId: 'uuid-1',
        browser: 'VeryLongBrowserNameExceedingThirtyTwoCharacters',
        version: 'VeryLongVersionNameExceedingThirtyTwoCharacters',
      },
    );
    expect(env.browser.length).toBe(32);
    expect(env.version.length).toBe(32);
  });
});