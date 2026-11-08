import { installClickHijackGuard } from '../core/clickHijackGuard';

(function initUniversalContent() {
  const host = window.location.hostname;
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    return; // Đã có content/index.ts cho YouTube
  }

  // Khởi động bảo vệ chống Click Hijacking ngay khi DOM xuất hiện
  installClickHijackGuard(document);
})();
