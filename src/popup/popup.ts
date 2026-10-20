import { ext } from '../platform/api';
import { formatSeconds } from '../core/format';
import type { Msg, TabStatus } from '../core/messages';

const out = document.getElementById('out');

async function currentTabId(): Promise<number | undefined> {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function refresh() {
  if (!out) return;
  const tabId = await currentTabId();
  if (tabId === undefined) {
    out.textContent = 'Không có tab đang mở.';
    return;
  }
  const msg: Msg = { kind: 'GET_STATUS', tabId };
  const status = (await ext.runtime.sendMessage(msg)) as TabStatus | null;
  out.textContent = status
    ? `Trạng thái: ${status.phase}\nQuảng cáo: ${status.adsDetected}\nThời lượng: ${formatSeconds(status.adSeconds)}`
    : 'Chưa có dữ liệu cho tab này. Hãy mở trang YouTube.';
}

void refresh();
const timer = setInterval(() => void refresh(), 500);
window.addEventListener('unload', () => clearInterval(timer));
