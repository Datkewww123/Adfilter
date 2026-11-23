export type YouTubeAdMode = 'fast-skip' | 'strict-defuser';

export const YT_AD_MODE_STORAGE_KEY = 'yt_adf_ad_mode';
export const YT_AD_MODE_MSG_TYPE = 'ADFILTER_YT_AD_MODE';

export interface Config {
  enabled: boolean;
  dryRun: boolean;
  maxSpeed: number;
  allowSeek: boolean;
  telemetry: boolean;
  youtubeAdMode: YouTubeAdMode;
}

/** Mặc định tối ưu: can thiệp ngay (dry-run tắt), tua nhanh 16x, cho phép seek, Chế độ B chặn tuyệt đối tại nguồn YouTube. */
export const defaultConfig: Config = {
  enabled: true,
  dryRun: false,
  maxSpeed: 16,
  allowSeek: true,
  telemetry: false,
  youtubeAdMode: 'strict-defuser',
};

export function normalizeYouTubeAdMode(raw: unknown): YouTubeAdMode {
  return raw === 'strict-defuser' || raw === 'fast-skip' ? raw : defaultConfig.youtubeAdMode;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readCachedYouTubeAdMode(storage?: StorageLike | null): YouTubeAdMode {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (store) {
      return normalizeYouTubeAdMode(store.getItem(YT_AD_MODE_STORAGE_KEY));
    }
  } catch {}
  return defaultConfig.youtubeAdMode;
}

export function writeCachedYouTubeAdMode(
  mode: YouTubeAdMode,
  storage?: StorageLike | null,
): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (store) {
      store.setItem(YT_AD_MODE_STORAGE_KEY, normalizeYouTubeAdMode(mode));
    }
  } catch {}
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export function normalizeConfig(raw: unknown): Config {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const bool = (key: keyof Config, fallback: boolean): boolean => {
    const v = r[key];
    return typeof v === 'boolean' ? v : fallback;
  };
  const speed = r.maxSpeed;
  return {
    enabled: bool('enabled', defaultConfig.enabled),
    dryRun: bool('dryRun', defaultConfig.dryRun),
    maxSpeed:
      typeof speed === 'number' && Number.isFinite(speed)
        ? clamp(speed, 1, 16)
        : defaultConfig.maxSpeed,
    allowSeek: bool('allowSeek', defaultConfig.allowSeek),
    telemetry: bool('telemetry', defaultConfig.telemetry),
    youtubeAdMode: normalizeYouTubeAdMode(r.youtubeAdMode),
  };
}
