import { ext } from '../platform/api';
import { log } from '../core/log';
import type { Msg, TabStatus } from '../core/messages';
import { describeStatus } from '../core/statusText';

const statusEl = document.getElementById('status');
const statCount = document.getElementById('stat-count');
const statTime = document.getElementById('stat-time');
const exportBtn = document.getElementById('exportLogs');
const resetBtn = document.getElementById('resetStats');

function show(lines: string[]): void {
  if (statusEl) statusEl.textContent = lines.join(' ');
}

function formatDuration(sec: number): string {
  if (sec <= 0) return '0 giây';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}p ${s}s` : `${m}p`;
}

async function refresh(): Promise<void> {
  // 1. Đọc số liệu tích lũy bền vững từ storage.local
  let totalBlocked = 0;
  let totalSeconds = 0;
  try {
    const persisted = await ext.storage.local.get(['stats_total_blocked', 'stats_total_seconds']);
    if (typeof persisted.stats_total_blocked === 'number') {
      totalBlocked = persisted.stats_total_blocked;
    }
    if (typeof persisted.stats_total_seconds === 'number') {
      totalSeconds = persisted.stats_total_seconds;
    }
  } catch {}

  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  if (tabId === undefined) {
    if (statCount) statCount.textContent = `${totalBlocked} quảng cáo`;
    if (statTime) statTime.textContent = formatDuration(totalSeconds);
    return show(['Không có tab YouTube đang mở.']);
  }

  try {
    const msg: Msg = { kind: 'GET_STATUS', tabId };
    const status = (await ext.runtime.sendMessage(msg)) as TabStatus | null;
    show(describeStatus(status));

    // Hiển thị số lượng lớn hơn giữa tổng tích lũy và số QC phát hiện trên tab
    const displayCount = Math.max(totalBlocked, status?.adsDetected ?? 0);
    const displaySeconds = Math.max(totalSeconds, Math.round(status?.adSeconds ?? 0));

    if (statCount) {
      statCount.textContent = `${displayCount} quảng cáo`;
    }
    if (statTime) {
      statTime.textContent = formatDuration(displaySeconds);
    }
  } catch (e) {
    log.warn('popup refresh failed', e);
    if (statCount) statCount.textContent = `${totalBlocked} quảng cáo`;
    if (statTime) statTime.textContent = formatDuration(totalSeconds);
    show(['Không kết nối được với extension. Hãy reload tab YouTube.']);
  }
}

exportBtn?.addEventListener('click', async () => {
  const data = await ext.storage.local.get([
    'actions',
    'config',
    'breaker',
    'stats_total_blocked',
    'stats_total_seconds',
  ]);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `adfilter-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// Nút Đặt lại bộ đếm: xóa stats trong storage, reset hiển thị về 0
resetBtn?.addEventListener('click', async () => {
  try {
    await ext.storage.local.remove(['stats_total_blocked', 'stats_total_seconds']);

    // Cập nhật UI ngay lập tức không cần chờ refresh
    if (statCount) statCount.textContent = '0 quảng cáo';
    if (statTime) statTime.textContent = '0 giây';
    show(['✅ Đã đặt lại bộ đếm. Theo dõi luồng phát...']);

    // Thông báo cho content script trên tab hiện tại reset phiên về 0
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    if (tab?.id !== undefined) {
      try {
        await ext.tabs.sendMessage(tab.id, { kind: 'RESET_STATS' } as Msg);
      } catch {
        // Tab chưa inject content script thì bỏ qua
      }
    }
  } catch (e) {
    log.warn('reset stats failed', e);
    show(['Lỗi khi đặt lại bộ đếm.']);
  }
});

void refresh();
