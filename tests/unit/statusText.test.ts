import { describe, expect, it } from 'vitest';
import { emptyStatus } from '../../src/core/messages';
import { describeStatus } from '../../src/core/statusText';

describe('describeStatus', () => {
  it('null trả về thông báo chưa có dữ liệu', () => {
    expect(describeStatus(null)).toEqual(['Chưa có dữ liệu cho tab này. Hãy mở trang YouTube.']);
  });

  it('trạng thái UNKNOWN hiển thị đang theo dõi', () => {
    const s = emptyStatus(); // phase mặc định là UNKNOWN
    const lines = describeStatus(s);
    expect(lines[0]).toContain('Đang theo dõi');
    // Không hiển thị adKind hay can thiệp khi chưa có dữ liệu
    expect(lines.some((l) => l.startsWith('Loại:'))).toBe(false);
    expect(lines.some((l) => l.startsWith('Can thiệp:'))).toBe(false);
  });

  it('trạng thái NORMAL hiển thị đang xem video bình thường', () => {
    const s = { ...emptyStatus(), phase: 'NORMAL' as const };
    const lines = describeStatus(s);
    expect(lines[0]).toContain('Đang xem video bình thường');
    // Khi NORMAL, không hiển thị adKind (dù có giá trị)
    expect(lines.some((l) => l.startsWith('Loại:'))).toBe(false);
    expect(lines.some((l) => l.startsWith('Quảng cáo:'))).toBe(false);
  });

  it('trạng thái AD hiển thị đang chặn và loại quảng cáo kèm can thiệp', () => {
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
    expect(lines[0]).toContain('Đang chặn quảng cáo');
    expect(lines).toContain('Loại: Có thể bỏ qua (95%)');
    expect(lines).toContain('Can thiệp: 3/4 thành công');
    // Không còn dòng "Quảng cáo: X · Thời lượng: Y" vì vô nghĩa khi Defuser chặn từ gốc
    expect(lines.some((l) => l.startsWith('Quảng cáo:'))).toBe(false);
  });

  it('không có dòng Can thiệp khi tổng bằng 0', () => {
    const s = emptyStatus();
    const lines = describeStatus(s);
    expect(lines.some((l) => l.startsWith('Can thiệp:'))).toBe(false);
  });

  it('adKind lạ thì in nguyên giá trị', () => {
    const s = { ...emptyStatus(), phase: 'AD' as const, adKind: 'CUSTOM_AD', confidence: 0.8 };
    const lines = describeStatus(s);
    expect(lines).toContain('Loại: CUSTOM_AD (80%)');
  });
});
