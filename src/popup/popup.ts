import { ext } from '../platform/api';
import { log } from '../core/log';
import type { Msg, TabStatus } from '../core/messages';
import { describeStatus } from '../core/statusText';
import { isDomainWhitelisted, toggleDomainWhitelist } from '../core/siteWhitelist';
import type { YouTubeAdMode } from '../storage/config';
import { loadConfig, saveConfig } from '../storage/configStore';

const statusEl = document.getElementById('status');
const exportBtn = document.getElementById('exportLogs');
const elementPickerBtn = document.getElementById('elementPickerBtn');
const openOptionsBtn = document.getElementById('openOptionsBtn');
const siteDomainEl = document.getElementById('siteDomain');
const siteStatusEl = document.getElementById('siteStatus');
const siteToggleBtn = document.getElementById('siteToggleBtn') as HTMLButtonElement | null;
const ytModeStatusEl = document.getElementById('ytModeStatus');
const ytModeToggleBtn = document.getElementById('ytModeToggleBtn') as HTMLButtonElement | null;

let currentHostname = '';
let currentYtMode: YouTubeAdMode = 'strict-defuser';

function renderYouTubeMode(mode: YouTubeAdMode): void {
  currentYtMode = mode;
  if (ytModeStatusEl) {
    ytModeStatusEl.textContent =
      mode === 'fast-skip' ? 'Chế độ A: Tải nhanh (<1s)' : 'Chế độ B: Chặn tuyệt đối';
  }
  if (ytModeToggleBtn) {
    ytModeToggleBtn.textContent = mode === 'fast-skip' ? 'Sang Chế độ B' : 'Sang Chế độ A';
  }
}

function show(lines: string[]): void {
  if (statusEl) statusEl.textContent = lines.join(' ');
}

async function updateSiteCard(): Promise<void> {
  if (!currentHostname) return;
  if (siteDomainEl) siteDomainEl.textContent = currentHostname;

  const data = await ext.storage.local.get(['whitelist_domains']);
  const whitelist: string[] = (data as any)?.whitelist_domains || [];
  const isPaused = isDomainWhitelisted(currentHostname, whitelist);

  if (siteStatusEl) {
    siteStatusEl.textContent = isPaused ? 'Đã tạm dừng trên trang này' : 'Đang bảo vệ trang này';
    siteStatusEl.className = isPaused ? 'site-status disabled' : 'site-status';
  }
  if (siteToggleBtn) {
    siteToggleBtn.textContent = isPaused ? 'Bật lại' : 'Tạm dừng';
  }
}

siteToggleBtn?.addEventListener('click', async () => {
  if (!currentHostname) return;
  const data = await ext.storage.local.get(['whitelist_domains']);
  const whitelist: string[] = (data as any)?.whitelist_domains || [];
  const updated = toggleDomainWhitelist(currentHostname, whitelist);
  await ext.storage.local.set({ whitelist_domains: updated });
  await updateSiteCard();
});

ytModeToggleBtn?.addEventListener('click', async () => {
  const next: YouTubeAdMode = currentYtMode === 'fast-skip' ? 'strict-defuser' : 'fast-skip';
  await saveConfig({ youtubeAdMode: next });
  renderYouTubeMode(next);
});

async function refresh(): Promise<void> {
  const cfg = await loadConfig().catch(() => null);
  if (cfg) renderYouTubeMode(cfg.youtubeAdMode);

  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  const url = tab?.url || '';

  if (url) {
    try {
      const parsed = new URL(url);
      currentHostname = parsed.hostname;
      await updateSiteCard();
    } catch {
      // Bỏ qua nếu url không phân tích được
    }
  }

  if (tabId === undefined) {
    return show(['Không có tab đang mở.']);
  }

  try {
    const msg: Msg = { kind: 'GET_STATUS', tabId };
    let status = (await ext.runtime.sendMessage(msg)) as TabStatus | null;
    if (!status) {
      try {
        status = (await ext.tabs.sendMessage(tabId, msg)) as TabStatus | null;
      } catch {
        // Tab chưa nạp content script hoặc không phải YouTube
      }
    }
    show(describeStatus(status, currentHostname));
  } catch (e) {
    log.warn('popup refresh failed', e);
    show(describeStatus(null, currentHostname));
  }
}

elementPickerBtn?.addEventListener('click', async () => {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) {
    try {
      await ext.tabs.sendMessage(tab.id, { kind: 'START_ELEMENT_PICKER' });
      window.close();
    } catch (e) {
      log.warn('cannot start element picker', e);
    }
  }
});

exportBtn?.addEventListener('click', async () => {
  const data = await ext.storage.local.get(['actions', 'config', 'breaker', 'whitelist_domains']);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `adfilter-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

openOptionsBtn?.addEventListener('click', () => {
  ext.runtime.openOptionsPage?.();
});

void refresh();
