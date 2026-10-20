import { ext } from '../platform/api';
import { isMsg, statusKey } from '../core/messages';

console.log('[AdFilter Background] 🚀 Service Worker đã nạp và bắt đầu lắng nghe!');

ext.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  console.log('[AdFilter Background] 📩 Nhận được message:', raw, 'từ tab:', sender.tab?.id);

  if (!isMsg(raw)) {
    console.warn('[AdFilter Background] ⚠️ Tin nhắn không hợp lệ theo isMsg:', raw);
    return false;
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

  // Nhánh GET_STATUS từ popup
  const key = statusKey(raw.tabId);
  void ext.storage.session.get(key).then((r) => {
    console.log(`[AdFilter Background] 📤 Trả lời GET_STATUS cho tab:${raw.tabId}:`, r[key] ?? null);
    sendResponse(r[key] ?? null);
  });
  return true; // Giữ kênh để trả lời bất đồng bộ
});

ext.tabs.onRemoved.addListener((tabId) => {
  console.log(`[AdFilter Background] 🗑️ Tab ${tabId} bị đóng, xóa khỏi storage`);
  void ext.storage.session.remove(statusKey(tabId));
});
