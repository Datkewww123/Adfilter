import { ext } from '../platform/api';
import { emptyStatus, type Msg, type TabStatus } from '../core/messages';
import { log } from '../core/log';

let currentStatus: TabStatus = { ...emptyStatus(), phase: 'NORMAL', updatedAt: Date.now() };
let timer: number | undefined;

function send(msg: Msg) {
  try {
    void ext.runtime.sendMessage(msg).catch(() => undefined);
  } catch {
    log.warn('extension context invalidated, stop sending');
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