import type { TabStatus } from './messages';

const PHASE_VI: Record<string, string> = {
  NORMAL: '▶ Đang xem video bình thường',
  AD: '🛡 Đang chặn quảng cáo...',
  UNKNOWN: '⏳ Đang theo dõi...',
};

export function describeStatus(s: TabStatus | null): string[] {
  if (!s) return ['Chưa có dữ liệu cho tab này. Hãy mở trang YouTube.'];

  // Hiển thị trạng thái theo ngôn ngữ tự nhiên thay vì số liệu kỹ thuật
  const phaseText = PHASE_VI[s.phase] ?? `Trạng thái: ${s.phase}`;
  const lines = [phaseText];

  // Chỉ hiển thị loại quảng cáo khi đang trong ad phase
  if (s.adKind && s.phase === 'AD') {
    const kindMap: Record<string, string> = {
      SKIPPABLE: 'Có thể bỏ qua',
      NON_SKIPPABLE: 'Không thể bỏ qua',
      SEQUENCE: 'Chuỗi quảng cáo',
      UNKNOWN: 'Chưa xác định',
    };
    lines.push(`Loại: ${kindMap[s.adKind] ?? s.adKind} (${Math.round(s.confidence * 100)}%)`);
  }

  // Chỉ hiển thị số can thiệp khi thực sự có (Defuser không chặn được, Actuator phải vào cuộc)
  const total = s.interventionsOk + s.interventionsFail;
  if (total > 0) {
    lines.push(`Can thiệp: ${s.interventionsOk}/${total} thành công`);
  }

  return lines;
}
