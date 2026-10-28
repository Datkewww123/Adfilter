export interface Config {
  enabled: boolean;
  dryRun: boolean;
  maxSpeed: number;
  allowSeek: boolean;
  telemetry: boolean;
}

/** Mặc định tối ưu: can thiệp ngay (dry-run tắt), tua nhanh 16x, cho phép seek. */
export const defaultConfig: Config = {
  enabled: true,
  dryRun: false,
  maxSpeed: 16,
  allowSeek: true,
  telemetry: false,
};

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
  };
}
