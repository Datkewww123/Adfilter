import { ext } from '../platform/api';
import { log } from '../core/log';
import { describeStatus } from '../core/statusText';
import type { Msg, TabStatus } from '../core/messages';
import { loadConfig, saveConfig } from '../storage/configStore';

const out = document.getElementById('out');
const enabled = document.getElementById('enabled') as HTMLInputElement | null;
const dryRun = document.getElementById('dryRun') as HTMLInputElement | null;
const exportBtn = document.getElementById('export');

async function currentTabId(): Promise<number | undefined> {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function show(lines: string[]): void {
  if (!out) return;
  out.replaceChildren(
    ...lines.map((l) => {
      const d = document.createElement('div');
      d.textContent = l;
      return d;
    }),
  );
}

async function refresh(): Promise<void> {
  const tabId = await currentTabId();
  if (tabId === undefined) return show(['Không có tab đang mở.']);
  try {
    const msg: Msg = { kind: 'GET_STATUS', tabId };
    show(describeStatus((await ext.runtime.sendMessage(msg)) as TabStatus | null));
  } catch (e) {
    log.warn('popup refresh failed', e);
    show(['Không kết nối được với extension. Thử mở lại popup.']);
  }
}

async function exportLogs(): Promise<void> {
  const data = await ext.storage.local.get(['actions', 'config', 'breaker']);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'adfilter-log-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

void loadConfig().then((c) => {
  if (enabled) enabled.checked = c.enabled;
  if (dryRun) dryRun.checked = c.dryRun;
});

enabled?.addEventListener('change', () => void saveConfig({ enabled: enabled.checked }));
dryRun?.addEventListener('change', () => void saveConfig({ dryRun: dryRun.checked }));
exportBtn?.addEventListener('click', () => void exportLogs());

void refresh();
const timer = setInterval(() => void refresh(), 500);
window.addEventListener('unload', () => clearInterval(timer));