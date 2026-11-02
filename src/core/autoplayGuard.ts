/**
 * Quyết định có nên thử tự phát video hay không.
 *
 * Mục tiêu: chỉ can thiệp đúng lúc YouTube đang giữ video ở trạng thái pause
 * lúc vừa nạp trang. Tuyệt đối không giành quyền pause của người dùng:
 * - Video phải đủ dữ liệu để phát mượt (readyState >= 3) mới được gọi play().
 *   Chờ đến HAVE_FUTURE_DATA tránh việc YouTube đổi nút sang Pause khi video
 *   vẫn còn đang load.
 * - Với livestream, phải kiểm tra video đã ở sát mép phát trực tiếp chưa.
 *   Nếu player còn đứng ở đầu DVR (currentTime ~ 0), phải tua tới live edge
 *   trước khi play, nếu không video sẽ phát lại từ đầu.
 * - Chỉ thử trong một khoảng thời gian ngắn sau khi nạp/chuyển video.
 * - Khi video đã phát ổn định (alreadyPlayed) thì không can thiệp nữa.
 */

/** Khoảng thời gian tối đa chờ video sẵn sàng sau khi nạp/chuyển bài. */
export const AUTOPLAY_WINDOW_MS = 15_000;

/** Thời gian video phải phát liên tục để coi là đã tự phát ổn định. */
export const AUTOPLAY_SETTLE_MS = 1_500;

/** HAVE_FUTURE_DATA — đủ dữ liệu để phát tiếp, không còn ở trạng thái load. */
export const MIN_READY_STATE = 3;

/** Sai số (giây) được coi là đang ở sát mép phát trực tiếp. */
export const LIVE_EDGE_TOLERANCE_S = 3;

/** Chỉ sửa live edge khi video còn nằm ở đầu timeline (0..1s). */
export const LIVE_REWIND_MAX_CURRENT_TIME_S = 1;

export interface AutoplaySnapshot {
  paused: boolean;
  ended: boolean;
  readyState: number;
  isAd: boolean;
  alreadyPlayed: boolean;
  now: number;
  deadline: number;
  /** Video là livestream (player có class ytp-live hoặc duration vô hạn/0). */
  isLive?: boolean;
  /** Livestream đã ở sát mép phát trực tiếp. */
  atLiveEdge?: boolean;
  /** Có thể đọc được vùng seekable để tua tới live edge. */
  canSeekLive?: boolean;
  /** Thời điểm hiện tại của video (giây). */
  currentTime?: number;
}

function canConsider(s: AutoplaySnapshot): boolean {
  if (s.isAd || s.ended || !s.paused || s.alreadyPlayed) return false;
  if (s.readyState < MIN_READY_STATE) return false;
  return s.now <= s.deadline;
}

export function shouldAttemptAutoplay(s: AutoplaySnapshot): boolean {
  if (!canConsider(s)) return false;
  if (s.isLive && !s.atLiveEdge) return false;
  return true;
}

/**
 * Livestream bị pause nhưng chưa ở live edge (thường gặp lúc vừa mở video,
 * currentTime còn 0) → cần tua tới live edge trước khi play.
 */
export function shouldSeekToLiveEdge(s: AutoplaySnapshot): boolean {
  if (!canConsider(s)) return false;
  return !!s.isLive && !!s.canSeekLive && !s.atLiveEdge;
}

/**
 * Livestream đang phát lại từ đầu DVR thay vì phát trực tiếp.
 * Chỉ sửa trong cửa sổ nạp trang và khi timeline vẫn ở sát 0 để tránh
 * giành quyền tua của người dùng.
 */
export function shouldCorrectLiveRewind(s: AutoplaySnapshot): boolean {
  if (s.isAd || s.ended || s.readyState < MIN_READY_STATE) return false;
  if (s.now > s.deadline) return false;
  if (!s.isLive || !s.canSeekLive || s.atLiveEdge) return false;
  return (s.currentTime ?? 0) <= LIVE_REWIND_MAX_CURRENT_TIME_S;
}

export interface LiveEdgeInfo {
  atLiveEdge: boolean;
  canSeek: boolean;
  edge: number | null;
  distance: number | null;
}

interface SeekableLike {
  length: number;
  end(index: number): number;
}

interface LiveVideoLike {
  currentTime: number;
  seekable: SeekableLike;
  duration?: number;
}

export function inspectLiveEdge(video: LiveVideoLike): LiveEdgeInfo {
  if (video.seekable.length === 0) {
    return { atLiveEdge: false, canSeek: false, edge: null, distance: null };
  }

  const index = video.seekable.length - 1;
  const edge = video.seekable.end(index);
  if (!Number.isFinite(edge) || edge <= 0) {
    return { atLiveEdge: false, canSeek: false, edge: null, distance: null };
  }

  const distance = edge - video.currentTime;
  return {
    atLiveEdge: distance >= 0 && distance <= LIVE_EDGE_TOLERANCE_S,
    canSeek: true,
    edge,
    distance,
  };
}

export function seekToLiveEdge(video: LiveVideoLike): boolean {
  // Chốt an toàn cuối cùng: chỉ tua video có duration = Infinity (livestream).
  // Mọi duration hữu hạn — kể cả 0/NaN — đều bị chặn để không tua nhầm VOD.
  if (video.duration !== undefined && video.duration !== Infinity) {
    return false;
  }

  const info = inspectLiveEdge(video);
  if (!info.canSeek || info.edge === null || info.atLiveEdge) return false;

  video.currentTime = Math.max(0, info.edge - 0.5);
  return true;
}

export function isLivePlayback(video: { duration: number }): boolean {
  // Chỉ duration = Infinity mới là dấu hiệu livestream đáng tin cậy.
  // duration = 0/NaN chỉ là metadata chưa nạp xong, có thể là video thường —
  // nếu coi đó là live, extension sẽ tua nhầm video thường tới cuối.
  return video.duration === Infinity;
}
