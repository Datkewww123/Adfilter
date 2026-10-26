import { describe, expect, it } from 'vitest';
import type { ActionRecord } from '../../src/core/actionRecord';
import { summarizeActions } from '../../src/core/stats';

const rec = (o: Partial<ActionRecord>): ActionRecord => ({
  at: 0,
  action: 'CLICK_SKIP',
  dryRun: false,
  ...o,
});

describe('summarizeActions', () => {
  it('rỗng thì toàn số 0 và successRate null', () => {
    const s = summarizeActions([]);
    expect(s.executed).toBe(0);
    expect(s.successRate).toBeNull();
  });

  it('đếm hành động đã thực hiện và không thực hiện được', () => {
    const s = summarizeActions([rec({ ok: true }), rec({ ok: false, error: 'x' })]);
    expect([s.executed, s.notExecuted]).toEqual([1, 1]);
    expect(s.byAction).toEqual({ CLICK_SKIP: 2 });
  });

  it('tính tỉ lệ xác minh và độ trễ trung vị', () => {
    const s = summarizeActions([
      rec({ verified: true, latencyMs: 1500 }),
      rec({ verified: true, latencyMs: 1700 }),
      rec({ verified: false, latencyMs: 1600 }),
    ]);
    expect(s.successRate).toBeCloseTo(2 / 3);
    expect(s.medianVerifyMs).toBe(1600);
  });

  it('dry-run tính riêng, không lẫn vào hành động thật', () => {
    const s = summarizeActions([rec({ dryRun: true }), rec({ ok: true })]);
    expect([s.dryRunRecords, s.executed]).toEqual([1, 1]);
  });

  it('đếm các sự kiện đặc biệt (meta)', () => {
    const s = summarizeActions([
      rec({ action: 'PLAYBACK_STUCK' }),
      rec({ action: 'ENFORCEMENT_SEEN' }),
    ]);
    expect([s.playbackStuck, s.enforcementSeen]).toEqual([1, 1]);
    expect(s.executed).toBe(0);
  });
});