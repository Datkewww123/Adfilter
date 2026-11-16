# Thẩm Định Quyền & Chính Sách Manifest V3 (`v3.0.0`)

Tài liệu này giải trình đầy đủ toàn bộ quyền (permissions), phạm vi host và tài nguyên web được khai báo trong [`src/manifest.json`](../../src/manifest.json) theo nguyên tắc **Quyền Tối Thiểu (Least Privilege)**. Mọi thay đổi đều được kiểm tra tự động bởi [`tests/unit/manifest.test.ts`](../../tests/unit/manifest.test.ts).

## 1. Bảng Quyền API (`permissions`)

| Quyền | Lý do sử dụng | Biện pháp giới hạn & bảo mật |
| :--- | :--- | :--- |
| `declarativeNetRequest` | Chặn và chuyển hướng tĩnh/động các request mạng quảng cáo, popunder, tracker qua 4 ruleset tích hợp (`ruleset_adnetworks`, `ruleset_global`, `ruleset_vietnam`, `ruleset_redirects`) và quy tắc tùy chỉnh của người dùng | So khớp trực tiếp ở tầng trình duyệt; extension không đọc payload hay cookie của request |
| `storage` | Lưu cấu hình người dùng, danh sách website loại trừ (`whitelist_domains`), bộ lọc tùy chỉnh và thống kê trạng thái tab | Toàn bộ dữ liệu nằm cục bộ trên trình duyệt; không tự động đồng bộ ra máy chủ ngoài |

## 2. Phạm vi Host (`host_permissions`) & `web_accessible_resources`

| Khai báo | Mục đích | Cơ chế bảo vệ |
| :--- | :--- | :--- |
| `*://*.youtube.com/*`<br>`*://youtube.com/*`<br>`*://m.youtube.com/*` | Vận hành bộ Stealth YouTube chuyên dụng (`defuser.js`, `content.js`, `cosmetic.css`) | Tách làn riêng biệt; mọi rule tổng quát đều tự động gắn `excludedInitiatorDomains` cho YouTube |
| `<all_urls>` | Chạy Universal AdBlock Engine (`universalDefuser.js`, `universalContent.js`) trên web đọc truyện, xem phim, báo chí (chống popunder, Closed Shadow DOM `.w-overlay`/`[data-zone]`, procedural cosmetic) | Người dùng có thể tạm dừng trên từng website (Per-Site Whitelist) chỉ với 1 click trong Popup |
| `web_accessible_resources` (`resources/*`) | Cung cấp tài nguyên giả rỗng (`noop.js`, `noop.css`, `noop.html`, `1x1.gif`) cho hành động `redirect` của DNR | Chỉ chứa tệp rỗng vô hại chống lỗi `onerror` anti-adblock; không chứa logic thu thập dữ liệu |

## 3. Các Quyền Tuyệt Đối KHÔNG Xin Cấp
- `tabs`, `cookies`, `history`, `webRequest`, `webRequestBlocking`, `downloads`, `alarms`: Không sử dụng và bị từ chối tự động trong `tests/unit/manifest.test.ts`.
- **Không thực thi mã từ xa (`eval` / remote JS):** Danh sách lọc từ xa chỉ chấp nhận URL HTTPS công khai (chống SSRF) và được biên dịch thành JSON DNR / selector CSS thuần.

## 4. Quy trình Thay đổi Quyền
Bất kỳ quyền hoặc host mới nào bổ sung vào `src/manifest.json` đều phải được cập nhật đồng thời tại `ALLOWED_PERMISSIONS` / `ALLOWED_HOSTS` trong `tests/unit/manifest.test.ts` và giải trình trong tài liệu này trước khi merge vào `main`.
