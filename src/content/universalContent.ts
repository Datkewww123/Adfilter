import { installClickHijackGuard } from '../core/clickHijackGuard';

(function initUniversalContent() {
  if (window.location.hostname.includes('youtube.com')) {
    return; // Đã có content/index.ts cho YouTube
  }

  // Khởi động bảo vệ chống Click Hijacking ngay khi DOM xuất hiện
  installClickHijackGuard(document);
})();