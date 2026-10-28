import { describe, expect, it } from 'vitest';
import { defaultConfig, normalizeConfig } from '../../src/storage/config';

describe('defaultConfig', () => {
  it('mặc định tối ưu: dry-run tắt, cho phép seek, tốc độ 16x', () => {
    expect(defaultConfig.dryRun).toBe(false);
    expect(defaultConfig.allowSeek).toBe(true);
    expect(defaultConfig.maxSpeed).toBe(16);
    expect(defaultConfig.telemetry).toBe(false);
  });
});

describe('normalizeConfig', () => {
  it.each([undefined, null, 'x', 5, [], {}])('đầu vào %j trả về mặc định', (raw) => {
    expect(normalizeConfig(raw)).toEqual(defaultConfig);
  });

  it('giữ giá trị hợp lệ', () => {
    const v = {
      enabled: false,
      dryRun: true,
      maxSpeed: 8,
      allowSeek: false,
      telemetry: true,
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

  it('bỏ qua giá trị sai kiểu', () => {
    expect(normalizeConfig({ enabled: 'yes', maxSpeed: '3' })).toEqual(defaultConfig);
  });
});
