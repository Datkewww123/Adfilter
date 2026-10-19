import { ext } from '../platform/api';
import { isMsg, statusKey } from '../core/messages';

ext.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  if (!isMsg(raw)) return false;

  if (raw.kind === 'STATUS_UPDATE') {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return false;
    void ext.storage.session.set({ [statusKey(tabId)]: raw.status });
    return false; // BẮT BUỘC CÓ: để kết thúc nhánh STATUS_UPDATE
  }

  // Đi qua được if ở trên thì TypeScript sẽ tự hiểu raw bây giờ là GET_STATUS (có tabId)
  const key = statusKey(raw.tabId);
  void ext.storage.session.get(key).then((r) => sendResponse(r[key] ?? null));
  return true; // Giữ kênh kết nối mở để trả lời bất đồng bộ
});

ext.tabs.onRemoved.addListener((tabId) => {
  void ext.storage.session.remove(statusKey(tabId));
});