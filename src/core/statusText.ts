import { formatSeconds } from './format';
import type { TabStatus } from './messages';

const KIND_VI: Record<string, string> = {
  SKIPPABLE: 'Bỏ qua được',
  NON_SKIPPABLE: 'Không bỏ qua được',
  SEQUENCE: 'Chuỗi quảng cáo',
  UNKNOWN: 'Chưa rõ',
};

export function describeStatus(s: TabStatus | null): string[] {
  if (!s) return ['Chưa có dữ liệu cho tab này. Hãy mở trang YouTube.'];

  const lines = [`Trạng thái: ${s.phase}`];
  if (s.adKind) {
    lines.push(`Loại: ${KIND_VI[s.adKind] ?? s.adKind} (${Math.round(s.confidence * 100)}%)`);
  }
  lines.push(`Quảng cáo: ${s.adsDetected} · Thời lượng: ${formatSeconds(s.adSeconds)}`);
  const total = s.interventionsOk + s.interventionsFail;
  if (total > 0) lines.push(`Can thiệp: ${s.interventionsOk}/${total} thành công`);
  return lines;
}