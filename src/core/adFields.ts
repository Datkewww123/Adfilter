/**
 * Danh sách các trường dữ liệu trong playerResponse mà YouTube dùng
 * để quyết định phát quảng cáo. Xóa các trường này trước khi trình
 * phát video đọc → trình phát nghĩ video không có quảng cáo.
 *
 * Mở rộng Tuần Stealth-3: Thêm adBreaks và playbackTracking để triệt tiêu mid-roll.
 */
export const AD_PLAYER_FIELDS: readonly string[] = [
  'adPlacements',
  'playerAds',
  'adSlots',
  'adBreakParams',
  'adBreakHeartbeatParams',
  'adBreaks',
] as const;

/**
 * Trường trong ytInitialData (trang chủ, kết quả tìm kiếm) chứa
 * quảng cáo dạng banner, promoted video.
 */
export const AD_PAGE_FIELDS: readonly string[] = [
  'adSlots',
  'promotedSparklesWebRenderer',
] as const;

/**
 * Xóa sạch các trường quảng cáo khỏi một đối tượng playerResponse.
 * Hàm thuần túy, không phụ thuộc DOM — có thể unit test 100%.
 */
export function stripAdFields<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly string[] = AD_PLAYER_FIELDS,
): T {
  if (obj == null || typeof obj !== 'object') return obj;
  for (const key of fields) {
    if (key in obj) {
      delete (obj as Record<string, unknown>)[key];
    }
  }
  return obj;
}
