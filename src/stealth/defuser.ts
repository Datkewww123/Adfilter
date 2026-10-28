/**
 * Defuser — Chạy trong MAIN world, document_start.
 * Đặt bẫy JSON.parse, getter/setter hook lên ytInitialPlayerResponse và ytplayer.config
 * để xóa sạch trường QC trước khi trình phát video YouTube kịp đọc.
 */
import './interceptor';

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

// Bẫy 1: JSON.parse — Chặn sạch mọi chuỗi JSON chứa quảng cáo
const origJSONParse = JSON.parse;
JSON.parse = function (text: string, reviver?: (this: any, key: string, value: any) => any) {
  const result = origJSONParse(text, reviver);
  if (result && typeof result === 'object') {
    purge(result);
    if ((result as Record<string, unknown>).playerResponse && typeof (result as Record<string, unknown>).playerResponse === 'object') {
      purge((result as Record<string, unknown>).playerResponse);
    }
  }
  return result;
};

// Bẫy 2: Dữ liệu Player của video
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

// Bẫy 3: Dữ liệu Trang chủ / Gợi ý
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

// Bẫy 4: ytplayer.config.args.raw_player_response
let _ytplayer: any = (window as any).ytplayer;
Object.defineProperty(window, 'ytplayer', {
  configurable: true,
  get() {
    return _ytplayer;
  },
  set(val: any) {
    if (val?.config?.args?.raw_player_response) {
      try {
        const raw = origJSONParse(val.config.args.raw_player_response);
        purge(raw);
        val.config.args.raw_player_response = JSON.stringify(raw);
      } catch {}
    }
    _ytplayer = val;
  },
});

console.log('[AdFilter Stealth] Defuser đã kích hoạt ở MAIN world (kèm bẫy JSON.parse)');
