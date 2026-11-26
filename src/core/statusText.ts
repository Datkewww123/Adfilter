import type { TabStatus } from './messages';

const PHASE_VI: Record<string, string> = {
  NORMAL: '▶ Đang xem video bình thường',
  AD: '🛡 Đang chặn quảng cáo...',
  UNKNOWN: '⏳ Đang theo dõi...',
};

function isYouTubeHost(hostname?: string): boolean {
  if (!hostname) return false;
  const h = hostname.trim().toLowerCase();
  return h === 'youtube.com' || h.endsWith('.youtube.com');
}

export function describeStatus(s: TabStatus | null, hostname?: string): string[] {
  if (!s) {
    if (isYouTubeHost(hostname)) {
      return ['🏠 Trình phát trực tuyến — Sẵn sàng bảo vệ (nhấn F5 nếu bạn vừa tải lại tiện ích).'];
    }
    if (hostname) {
      return ['🛡️ Đang lọc quảng cáo, banner & chống popup trên trang này.'];
    }
    return ['Chưa có dữ liệu cho tab này. Hãy mở trang web hoặc trình phát video.'];
  }

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
