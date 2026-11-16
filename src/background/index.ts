import { ext } from '../platform/api';
import { isMsg, statusKey } from '../core/messages';
import { getFilterListsConfig, syncDynamicFilters } from './dynamicFilters';

const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000;

console.log('[AdFilter Background] 🚀 Service Worker đã nạp và bắt đầu lắng nghe!');

async function bootstrapFilters(forceRemote = false): Promise<void> {
  try {
    const cfg = await getFilterListsConfig();
    const stale = cfg.remoteFilterUrls.length > 0 && Date.now() - cfg.lastUpdatedAt >= DAILY_REFRESH_MS;
    await syncDynamicFilters({ fetchRemote: forceRemote || stale });
  } catch {
    // Giữ service worker ổn định nếu storage/DNR chưa sẵn sàng trong môi trường test
  }
}

ext.runtime.onInstalled?.addListener?.(() => {
  void bootstrapFilters(true);
});

ext.runtime.onStartup?.addListener?.(() => {
  void bootstrapFilters(false);
});

ext.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  console.log('[AdFilter Background] 📩 Nhận được message:', raw, 'từ tab:', sender.tab?.id);

  if (!isMsg(raw)) {
    console.warn('[AdFilter Background] ⚠️ Tin nhắn không hợp lệ theo isMsg:', raw);
    return false;
  }

  if (raw.kind === 'SYNC_FILTERS' || raw.kind === 'UPDATE_REMOTE_FILTERS') {
    void syncDynamicFilters({ fetchRemote: raw.kind === 'UPDATE_REMOTE_FILTERS' })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (raw.kind === 'STATUS_UPDATE') {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      console.warn('[AdFilter Background] ⚠️ sender.tab.id không tồn tại!');
      return false;
    }
    console.log(`[AdFilter Background] 💾 Lưu status tab:${tabId} vào storage:`, raw.status);
    void ext.storage.session.set({ [statusKey(tabId)]: raw.status });
    return false; // Kết thúc nhánh STATUS_UPDATE
  }

  if (raw.kind === 'RESET_STATS') {
    return false; // Background không cần xử lý, content script tự handle
  }

  // Nhánh GET_STATUS từ popup
  if (raw.kind === 'GET_STATUS') {
    const key = statusKey(raw.tabId);
    void ext.storage.session.get(key).then((r) => {
      console.log(`[AdFilter Background] 📤 Trả lời GET_STATUS cho tab:${raw.tabId}:`, r[key] ?? null);
      sendResponse(r[key] ?? null);
    });
    return true; // Giữ kênh để trả lời bất đồng bộ
  }

  return false;
});

ext.tabs.onRemoved.addListener((tabId) => {
  console.log(`[AdFilter Background] 🗑️ Tab ${tabId} bị đóng, xóa khỏi storage`);
  void ext.storage.session.remove(statusKey(tabId));
});
