import { ext } from '../platform/api';
import { defaultConfig, normalizeConfig, type Config } from './config';

export const CONFIG_KEY = 'config';

/**
 * Tăng CONFIG_VERSION mỗi khi thay đổi cấu trúc hoặc giá trị mặc định của Config.
 * Khi version không khớp, storage cũ sẽ bị bỏ qua và dùng defaultConfig mới.
 */
const CONFIG_VERSION = 4; // v4: purge stale maxSpeed 4x cache, enforce 16x
const CONFIG_VERSION_KEY = 'config_version';

export async function loadConfig(): Promise<Config> {
  const r = await ext.storage.local.get([CONFIG_KEY, CONFIG_VERSION_KEY]);
  const storedVersion = r[CONFIG_VERSION_KEY] as number | undefined;

  // Nếu version cũ hơn → xóa config cũ, dùng default mới
  if (storedVersion !== CONFIG_VERSION && r[CONFIG_KEY] === undefined) {
    await ext.storage.local.set({
      [CONFIG_KEY]: defaultConfig,
      [CONFIG_VERSION_KEY]: CONFIG_VERSION,
    });
    return defaultConfig;
  }

  return normalizeConfig(r[CONFIG_KEY]);
}

export async function saveConfig(patch: Partial<Config>): Promise<void> {
  const current = await loadConfig();
  await ext.storage.local.set({
    [CONFIG_KEY]: { ...current, ...patch },
    [CONFIG_VERSION_KEY]: CONFIG_VERSION,
  });
}
