import { loadConfig, saveConfig } from '../storage/configStore';

const speed = document.getElementById('maxSpeed') as HTMLInputElement | null;
const seek = document.getElementById('allowSeek') as HTMLInputElement | null;
const telemetry = document.getElementById('telemetry') as HTMLInputElement | null;

async function init(): Promise<void> {
  const c = await loadConfig();
  if (speed) speed.value = String(c.maxSpeed);
  if (seek) seek.checked = c.allowSeek;
  if (telemetry) telemetry.checked = c.telemetry;
}

speed?.addEventListener('change', () => {
  const v = Number(speed.value);
  if (Number.isFinite(v)) void saveConfig({ maxSpeed: v }).then(init);
});
seek?.addEventListener('change', () => void saveConfig({ allowSeek: seek.checked }));
telemetry?.addEventListener('change', () => void saveConfig({ telemetry: telemetry.checked }));

void init();