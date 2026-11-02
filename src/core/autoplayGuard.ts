/**
 * Quyết định có nên thử tự phát video hay không.
 *
 * Mục tiêu: chỉ can thiệp đúng lúc YouTube đang giữ video ở trạng thái pause
 * lúc vừa nạp trang. Tuyệt đối không giành quyền pause của người dùng:
 * - Video phải đã có dữ liệu (readyState >= 2) mới được gọi play().
 * - Chỉ thử trong một khoảng thời gian ngắn sau khi nạp/chuyển video.
 * - Khi video đã phát ổn định (alreadyPlayed) thì không can thiệp nữa.
 */

/** Khoảng thời gian tối đa chờ video sẵn sàng sau khi nạp/chuyển bài. */
export const AUTOPLAY_WINDOW_MS = 15_000;

/** Thời gian video phải phát liên tục để coi là đã tự phát ổn định. */
export const AUTOPLAY_SETTLE_MS = 1_500;

export interface AutoplaySnapshot {
  paused: boolean;
  ended: boolean;
  readyState: number;
  isAd: boolean;
  alreadyPlayed: boolean;
  now: number;
  deadline: number;
}

export function shouldAttemptAutoplay(s: AutoplaySnapshot): boolean {
  if (s.isAd || s.ended || !s.paused || s.alreadyPlayed) return false;
  if (s.readyState < 2) return false;
  return s.now <= s.deadline;
}
