import { describe, expect, it } from 'vitest';
import { defaultConfig, normalizeConfig } from '../../src/storage/config';

describe('defaultConfig', () => {
  it('mặc định tối ưu: dry-run tắt, cho phép seek, tốc độ 16x, chế độ strict-defuser (Chế độ B)', () => {
    expect(defaultConfig.dryRun).toBe(false);
    expect(defaultConfig.allowSeek).toBe(true);
    expect(defaultConfig.maxSpeed).toBe(16);
    expect(defaultConfig.telemetry).toBe(false);
    expect(defaultConfig.youtubeAdMode).toBe('strict-defuser');
  });
});

describe('normalizeConfig', () => {
  it.each([undefined, null, 'x', 5, [], {}])('đầu vào %j trả về mặc định', (raw) => {
    expect(normalizeConfig(raw)).toEqual(defaultConfig);
  });

  it('giữ giá trị hợp lệ kể cả strict-defuser', () => {
    const v = {
      enabled: false,
      dryRun: true,
      maxSpeed: 8,
      allowSeek: false,
      telemetry: true,
      youtubeAdMode: 'strict-defuser' as const,
    };
    expect(normalizeConfig(v)).toEqual(v);
  });

  it('kẹp tốc độ vào khoảng 1 đến 16', () => {
    expect(normalizeConfig({ maxSpeed: 100 }).maxSpeed).toBe(16);
    expect(normalizeConfig({ maxSpeed: 0.1 }).maxSpeed).toBe(1);
  });

  it('tốc độ không hữu hạn thì dùng mặc định', () => {
    expect(normalizeConfig({ maxSpeed: Number.NaN }).maxSpeed).toBe(defaultConfig.maxSpeed);
    expect(normalizeConfig({ maxSpeed: Infinity }).maxSpeed).toBe(defaultConfig.maxSpeed);
  });

  it('bỏ qua giá trị sai kiểu kể cả youtubeAdMode không hợp lệ', () => {
    expect(normalizeConfig({ enabled: 'yes', maxSpeed: '3', youtubeAdMode: 'unknown' })).toEqual(
      defaultConfig,
    );
  });
});
