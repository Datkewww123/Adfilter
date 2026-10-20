import { ext } from '../platform/api';
import { emptyStatus, type Msg, type TabStatus } from '../core/messages';

console.log('[AdFilter Content] 🎬 Content script đang chạy trên YouTube!');

// Đổi tên thành currentStatus để TRÁNH xung đột với window.status của trình duyệt (window.status luôn ép kiểu thành string "[object Object]")
let currentStatus: TabStatus = { ...emptyStatus(), phase: 'NORMAL', updatedAt: Date.now() };
let timer: number | undefined;

function send(msg: Msg) {
  console.log('[AdFilter Content] 📤 Đang gửi message:', msg.kind);
  try {
    ext.runtime
      .sendMessage(msg)
      .then(() => {
        console.log('[AdFilter Content] ✅ Gửi message thành công!');
      })
      .catch((err: unknown) => {
        console.warn('[AdFilter Content] ⚠️ Lỗi khi gửi (bất đồng bộ):', err);
      });
  } catch (err: unknown) {
    console.error('[AdFilter Content] ❌ Lỗi đồng bộ (context có thể bị vô hiệu hóa):', err);
    if (timer !== undefined) clearInterval(timer);
  }
}

// Gửi ngay khi trang vừa load
send({ kind: 'STATUS_UPDATE', status: currentStatus });

// Gửi định kỳ mỗi 5 giây (tạm thời — Tuần 3 thay bằng sự kiện thật)
timer = window.setInterval(() => {
  currentStatus = { ...currentStatus, updatedAt: Date.now() };
  send({ kind: 'STATUS_UPDATE', status: currentStatus });
}, 5000);
