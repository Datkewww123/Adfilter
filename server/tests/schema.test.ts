import { describe, expect, it } from 'vitest';
import { BatchSchema, EventSchema } from '../src/schema';

const ok = {
  clientId: '3b241101-e2bb-4255-8caf-4136c566a962',
  browser: 'Chrome/130',
  version: '0.1.0',
  type: 'AD_START',
  ts: 1_700_000_000_000,
};

describe('EventSchema', () => {
  it('chấp nhận sự kiện hợp lệ', () => {
    expect(EventSchema.safeParse(ok).success).toBe(true);
  });

  it('từ chối trường lạ như url (bảo vệ quyền riêng tư tuyệt đối)', () => {
    expect(EventSchema.safeParse({ ...ok, url: 'https://youtube.com/watch?v=123' }).success).toBe(false);
  });

  it('từ chối loại sự kiện lạ ngoài danh mục', () => {
    expect(EventSchema.safeParse({ ...ok, type: 'HACK' }).success).toBe(false);
  });

  it('từ chối clientId không phải định dạng UUID', () => {
    expect(EventSchema.safeParse({ ...ok, clientId: 'invalid-id' }).success).toBe(false);
  });

  it('chấp nhận lô sự kiện hợp lệ dưới 200 bản ghi', () => {
    expect(BatchSchema.safeParse([ok, ok]).success).toBe(true);
  });
});