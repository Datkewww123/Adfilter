import type { Signals } from './types';

/**
 * Kiểm tra xem video có bị kẹt hay không:
 * - next.paused phải là false (video đang chạy). Người dùng tự bấm tạm dừng không tính là kẹt.
 * - Khoảng cách kiểm tra >= 2000ms (2 giây).
 * - currentTime giữa 2 lần kiểm tra chênh lệch < 0.01s (đứng yên).
 */
export function isStuck(prev: Signals, next: Signals): boolean {
  if (next.paused !== false) return false;
  if (prev.currentTime === null || next.currentTime === null) return false;
  if (next.t - prev.t < 2000) return false;
  return Math.abs(next.currentTime - prev.currentTime) < 0.01;
}