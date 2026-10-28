import { loadConfig, saveConfig } from '../storage/configStore';
import { defaultStealthConfig, STEALTH_CONFIG_KEY, type StealthConfig } from '../core/stealthConfig';
import { ext } from '../platform/api';

const speed = document.getElementById('maxSpeed') as HTMLInputElement | null;
const seek = document.getElementById('allowSeek') as HTMLInputElement | null;
const telemetry = document.getElementById('telemetry') as HTMLInputElement | null;

const defuser = document.getElementById('defuserEnabled') as HTMLInputElement | null;
const cosmetic = document.getElementById('cosmeticEnabled') as HTMLInputElement | null;
const mask = document.getElementById('visualMaskEnabled') as HTMLInputElement | null;
const fallback = document.getElementById('fastSeekFallback') as HTMLInputElement | null;

async function getStealthConfig(): Promise<StealthConfig> {
  const r = await ext.storage.local.get(STEALTH_CONFIG_KEY);
  return { ...defaultStealthConfig, ...(r[STEALTH_CONFIG_KEY] ?? {}) };
}

async function saveStealthConfig(patch: Partial<StealthConfig>): Promise<void> {
  const cur = await getStealthConfig();
  await ext.storage.local.set({ [STEALTH_CONFIG_KEY]: { ...cur, ...patch } });
}

async function init(): Promise<void> {
  const c = await loadConfig();
  if (speed) speed.value = String(c.maxSpeed);
  if (seek) seek.checked = c.allowSeek;
  if (telemetry) telemetry.checked = c.telemetry;

  const sc = await getStealthConfig();
  if (defuser) defuser.checked = sc.defuserEnabled;
  if (cosmetic) cosmetic.checked = sc.cosmeticEnabled;
  if (mask) mask.checked = sc.visualMaskEnabled;
  if (fallback) fallback.checked = sc.fastSeekFallback;
}

speed?.addEventListener('change', () => {
  const v = Number(speed.value);
  if (Number.isFinite(v)) void saveConfig({ maxSpeed: v }).then(init);
});
seek?.addEventListener('change', () => void saveConfig({ allowSeek: seek.checked }));
telemetry?.addEventListener('change', () => void saveConfig({ telemetry: telemetry.checked }));

defuser?.addEventListener('change', () => void saveStealthConfig({ defuserEnabled: defuser.checked }));
cosmetic?.addEventListener('change', () => void saveStealthConfig({ cosmeticEnabled: cosmetic.checked }));
mask?.addEventListener('change', () => void saveStealthConfig({ visualMaskEnabled: mask.checked }));
fallback?.addEventListener('change', () => void saveStealthConfig({ fastSeekFallback: fallback.checked }));

void init();