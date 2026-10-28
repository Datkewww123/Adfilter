/**
 * Benchmark Test — Đảm bảo logic purge() hoàn thành trong dưới 5ms.
 * Test trực tiếp logic xóa trường QC (không import defuser.ts vì
 * module đó bẫy window.fetch ở import-time, chỉ chạy được trong browser).
 */
import { describe, expect, it } from 'vitest';

// Sao chép logic purge() thuần túy để có thể test trong Node
const AD_KEYS = [
  'adPlacements',
  'playerAds',
  'adSlots',
  'adBreakParams',
  'adBreakHeartbeatParams',
  'adBreaks',
  'playbackTracking',
];

function purge(obj: unknown): void {
  if (obj == null || typeof obj !== 'object') return;
  const record = obj as Record<string, unknown>;
  for (const key of AD_KEYS) {
    if (key in record) delete record[key];
  }
  if (Array.isArray(record.entries)) {
    record.entries = record.entries.filter(
      (entry: any) => !entry?.command?.reelWatchEndpoint?.ad,
    );
  }
}

describe('benchmark: hiệu năng purge()', () => {
  const buildFakeResponse = () => ({
    videoDetails: { videoId: 'bench001', title: 'Benchmark Video' },
    adPlacements: Array.from({ length: 20 }, (_, i) => ({ id: i, renderer: {} })),
    playerAds: Array.from({ length: 10 }, (_, i) => ({ id: i, ad: {} })),
    adSlots: Array.from({ length: 5 }, (_, i) => ({ id: i })),
    adBreakParams: { breakType: 'MID_ROLL', adParams: {} },
    adBreakHeartbeatParams: { heartbeat: 'ping' },
    adBreaks: Array.from({ length: 8 }, (_, i) => ({ breakId: i })),
    playbackTracking: { atrUrl: 'https://google.com/atr', vastStats: {} },
    streamingData: { formats: Array.from({ length: 30 }, (_, i) => ({ itag: i })) },
    entries: Array.from({ length: 50 }, (_, i) => ({
      command: {
        reelWatchEndpoint: i % 3 === 0 ? { ad: true } : { videoId: `vid_${i}` },
      },
    })),
  });

  it('purge() hoàn thành dưới 5ms trên 1 đối tượng lớn', () => {
    const obj = buildFakeResponse();
    const start = performance.now();
    purge(obj);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5);
    // Xác nhận đã xóa trường QC
    expect('adPlacements' in obj).toBe(false);
    expect('playerAds' in obj).toBe(false);
    expect('adBreaks' in obj).toBe(false);
    expect('playbackTracking' in obj).toBe(false);
    // Dữ liệu video chính vẫn còn
    expect(obj.videoDetails).toBeDefined();
    expect(obj.streamingData).toBeDefined();
  });

  it('purge() hoàn thành dưới 5ms khi chạy 100 lần liên tiếp (trung bình)', () => {
    const RUNS = 100;
    const start = performance.now();
    for (let i = 0; i < RUNS; i++) {
      purge(buildFakeResponse());
    }
    const total = performance.now() - start;
    const avg = total / RUNS;

    // Trung bình mỗi lần dưới 5ms
    expect(avg).toBeLessThan(5);
  });

  it('purge() không throw và hoàn thành nhanh với null/primitive', () => {
    const start = performance.now();
    purge(null);
    purge(undefined);
    purge(42 as unknown as object);
    purge('string' as unknown as object);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5);
  });

  it('purge() lọc đúng entries có ad trên Shorts', () => {
    const obj = buildFakeResponse();
    const totalEntries = obj.entries.length; // 50
    purge(obj);
    // i % 3 === 0 → có ad → bị lọc (entries 0, 3, 6, ..., 48 = 17 entries bị xóa)
    const adEntries = Array.from({ length: 50 }, (_, i) => i).filter(i => i % 3 === 0);
    expect(obj.entries.length).toBe(totalEntries - adEntries.length);
  });
});
