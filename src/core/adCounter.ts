export interface AdCounter {
  index: number;
  total: number;
}

export function parseCounter(text: string | null | undefined): AdCounter | null {
  const m = text?.match(/([0-9]+)[^0-9]+([0-9]+)/);
  if (!m) return null;
  const index = Number(m[1]);
  const total = Number(m[2]);
  // Chỉ nhận nếu index trong khoảng 1..total và chuỗi quảng cáo tối đa 10 video
  return index >= 1 && index <= total && total <= 10 ? { index, total } : null;
}