/**
 * AdFilter Stealth Pipeline — Pipeline chặn quảng cáo 3 lớp thống nhất.
 *
 * Kiến trúc phòng thủ theo chiều sâu:
 *
 *  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
 *  │   LỚP 1:        │    │   LỚP 2:        │    │   LỚP 3:        │
 *  │   Defuser       │──▶│   Visual Mask   │──▶│   Fast Seek     │
 *  │   (Triệt gốc)   │    │   (Che mắt)     │    │   (Tua cuối)    │
 *  │  document_start │    │   < 50ms        │    │   ~0.05s        │
 *  └─────────────────┘    └─────────────────┘    └─────────────────┘
 *         │                       │                       │
 *         ▼                       ▼                       ▼
 *   99% QC bị chặn          Lọt → che ngay         Lọt nữa → tua
 *
 * Module này cung cấp API thống nhất để kết nối cả 3 lớp với nhau,
 * với WatchdogReport để giám sát sức khỏe định kỳ.
 */

import { applyMask, removeMask } from './visual-mask';
import { inspectHealth, type WatchdogReport } from './watchdog';
import { releaseScrollLockIfSafe } from './scrollLock';

// ─── Trạng thái pipeline ─────────────────────────────────────────────────────

export type PipelineLayer = 'DEFUSER' | 'VISUAL_MASK' | 'FAST_SEEK' | 'IDLE';

export interface PipelineStatus {
  /** Lớp đang hoạt động hiện tại */
  activeLayer: PipelineLayer;
  /** Tổng số lần Defuser chặn (được tăng từ bên ngoài thông qua reportDefused()) */
  defusedCount: number;
  /** Tổng số lần Visual Mask được kích hoạt */
  maskCount: number;
  /** Tổng số lần Fast Seek tua video */
  seekCount: number;
  /** Trạng thái sức khỏe từ Watchdog lần kiểm tra gần nhất */
  lastHealth: WatchdogReport | null;
  /** Thời điểm khởi động pipeline (ms) */
  startedAt: number;
}

const state: PipelineStatus = {
  activeLayer: 'IDLE',
  defusedCount: 0,
  maskCount: 0,
  seekCount: 0,
  lastHealth: null,
  startedAt: Date.now(),
};

// ─── API công khai ────────────────────────────────────────────────────────────

/**
 * Gọi khi phát hiện quảng cáo bắt đầu (AD_START).
 * Kích hoạt Lớp 2 — Visual Mask che màn hình tức thời.
 */
export function onAdStart(): void {
  state.activeLayer = 'VISUAL_MASK';
  state.maskCount++;
  applyMask();
}

/**
 * Gọi khi quảng cáo kết thúc (AD_END).
 * Gỡ Visual Mask, mở khóa scroll và đặt pipeline về IDLE.
 */
export function onAdEnd(): void {
  state.activeLayer = 'IDLE';
  removeMask();
  // Unlock scroll after ad ends
  releaseScrollLockIfSafe(document);
}

/**
 * Gọi khi Lớp 3 (Fast Seek) được thực thi.
 * Tăng bộ đếm để theo dõi tần suất.
 */
export function onSeekExecuted(): void {
  state.activeLayer = 'FAST_SEEK';
  state.seekCount++;
}

/**
 * Gọi từ Defuser khi thanh lọc một đối tượng playerResponse.
 * Tăng bộ đếm lớp 1.
 */
export function reportDefused(): void {
  state.defusedCount++;
}

/**
 * Trả về snapshot trạng thái pipeline hiện tại (bất biến).
 */
export function getPipelineStatus(): Readonly<PipelineStatus> {
  return { ...state };
}

/**
 * Chạy Watchdog kiểm tra sức khỏe — CSS selectors còn đúng không,
 * adPlacements có lọt qua không. Cập nhật lastHealth trong state.
 * @returns WatchdogReport
 */
export function runHealthCheck(): WatchdogReport {
  const report = inspectHealth(document);
  state.lastHealth = report;
  return report;
}

/**
 * Reset bộ đếm pipeline về 0 (dùng cho unit test hoặc phiên mới).
 */
export function resetPipelineCounters(): void {
  state.activeLayer = 'IDLE';
  state.defusedCount = 0;
  state.maskCount = 0;
  state.seekCount = 0;
  state.lastHealth = null;
  state.startedAt = Date.now();
}
