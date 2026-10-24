import { describe, expect, it } from 'vitest';
import { defaultConfig, normalizeConfig } from '../../src/storage/config';

describe('defaultConfig', () => {
  it('mặc định an toàn: dry-run bật, không tua, không telemetry', () => {
    expect(defaultConfig.dryRun).toBe(true);
    expect(defaultConfig.allowSeek).toBe(false);
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
      dryRun: false,
      maxSpeed: 3,
      allowSeek: true,
      telemetry: true,
    };
    expect(normalizeConfig(v)).toEqual(v);
  });

  it('kẹp tốc độ vào khoảng 1 đến 4', () => {
    expect(normalizeConfig({ maxSpeed: 100 }).maxSpeed).toBe(4);
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