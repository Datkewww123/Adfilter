/**
 * Defuser — Chạy trong MAIN world, document_start.
 * Đặt getter/setter hook lên ytInitialPlayerResponse để xóa sạch trường QC
 * trước khi trình phát video YouTube kịp đọc.
 */

const AD_KEYS = [
  'adPlacements',
  'playerAds',
  'adSlots',
  'adBreakParams',
  'adBreakHeartbeatParams',
];

function purge(obj: unknown): void {
  if (obj == null || typeof obj !== 'object') return;
  const record = obj as Record<string, unknown>;
  for (const key of AD_KEYS) {
    if (key in record) delete record[key];
  }
}

// Bẫy 1: Dữ liệu Player của video
let _playerResponse: unknown = undefined;

Object.defineProperty(window, 'ytInitialPlayerResponse', {
  configurable: true,
  get() {
    return _playerResponse;
  },
  set(val: unknown) {
    purge(val);
    _playerResponse = val;
  },
});

// Bẫy 2: Dữ liệu Trang chủ / Gợi ý
let _initialData: unknown = undefined;

Object.defineProperty(window, 'ytInitialData', {
  configurable: true,
  get() {
    return _initialData;
  },
  set(val: unknown) {
    if (val != null && typeof val === 'object') {
      const record = val as Record<string, unknown>;
      delete record['adSlots'];
      delete record['promotedSparklesWebRenderer'];
    }
    _initialData = val;
  },
});

console.log('[AdFilter Stealth] Defuser đã kích hoạt ở MAIN world');