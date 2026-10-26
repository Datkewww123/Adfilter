import { describe, expect, it } from 'vitest';
import { emptyStatus } from '../../src/core/messages';
import { describeStatus } from '../../src/core/statusText';

describe('describeStatus', () => {
  it('null trả về thông báo chưa có dữ liệu', () => {
    expect(describeStatus(null)).toEqual(['Chưa có dữ liệu cho tab này. Hãy mở trang YouTube.']);
  });

  it('trạng thái đầy đủ cho đúng các dòng', () => {
    const s = {
      ...emptyStatus(),
      phase: 'AD' as const,
      adKind: 'SKIPPABLE',
      confidence: 0.95,
      adsDetected: 2,
      adSeconds: 43,
      interventionsOk: 3,
      interventionsFail: 1,
    };
    const lines = describeStatus(s);
    expect(lines).toContain('Trạng thái: AD');
    expect(lines).toContain('Loại: Bỏ qua được (95%)');
    expect(lines).toContain('Quảng cáo: 2 · Thời lượng: 0:43');
    expect(lines).toContain('Can thiệp: 3/4 thành công');
  });

  it('không có dòng Can thiệp khi tổng bằng 0', () => {
    const s = emptyStatus();
    const lines = describeStatus(s);
    expect(lines.some((l) => l.startsWith('Can thiệp:'))).toBe(false);
  });

  it('adKind lạ thì in nguyên giá trị', () => {
    const s = { ...emptyStatus(), adKind: 'CUSTOM_AD', confidence: 0.8 };
    const lines = describeStatus(s);
    expect(lines).toContain('Loại: CUSTOM_AD (80%)');
  });
});