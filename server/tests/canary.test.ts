import { describe, expect, it } from 'vitest';
import { runCanaryCheck } from '../src/canary';

class MockPool {
  constructor(private mockRow: { total: string; enforcement: string; stuck: string }) {}
  async query() {
    return { rows: [this.mockRow] };
  }
}

describe('Canary Evaluation Logic', () => {
  it('tính đúng tỉ lệ và không kích hoạt cảnh báo khi dưới ngưỡng 5%', async () => {
    const pool = new MockPool({ total: '100', enforcement: '2', stuck: '1' }) as any;
    const report = await runCanaryCheck(pool, 60);
    expect(report.enforcementRate).toBe(2);
    expect(report.alertTriggered).toBe(false);
  });

  it('kích hoạt cảnh báo khi tỉ lệ enforcement >= 5% và mẫu đủ lớn', async () => {
    const pool = new MockPool({ total: '100', enforcement: '15', stuck: '3' }) as any;
    const report = await runCanaryCheck(pool, 60);
    expect(report.enforcementRate).toBe(15);
    expect(report.alertTriggered).toBe(true);
  });
});