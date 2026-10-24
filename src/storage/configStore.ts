import { ext } from '../platform/api';
import { normalizeConfig, type Config } from './config';

export const CONFIG_KEY = 'config';

export async function loadConfig(): Promise<Config> {
  const r = await ext.storage.local.get(CONFIG_KEY);
  return normalizeConfig(r[CONFIG_KEY]);
}

export async function saveConfig(patch: Partial<Config>): Promise<void> {
  const current = await loadConfig();
  await ext.storage.local.set({ [CONFIG_KEY]: { ...current, ...patch } });
}