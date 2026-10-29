import { ext } from '../platform/api';
import { log } from '../core/log';
import type { Msg, TabStatus } from '../core/messages';
import { describeStatus } from '../core/statusText';

const statusEl = document.getElementById('status');
const exportBtn = document.getElementById('exportLogs');

function show(lines: string[]): void {
  if (statusEl) statusEl.textContent = lines.join(' ');
}

async function refresh(): Promise<void> {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  if (tabId === undefined) {
    return show(['Không có tab YouTube đang mở.']);
  }

  try {
    const msg: Msg = { kind: 'GET_STATUS', tabId };
    const status = (await ext.runtime.sendMessage(msg)) as TabStatus | null;
    show(describeStatus(status));
  } catch (e) {
    log.warn('popup refresh failed', e);
    show(['Không kết nối được với extension. Hãy reload tab YouTube.']);
  }
}

exportBtn?.addEventListener('click', async () => {
  const data = await ext.storage.local.get(['actions', 'config', 'breaker']);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `adfilter-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

void refresh();
