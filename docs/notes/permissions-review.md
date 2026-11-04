# Duyệt quyền Extension (Permissions Review)

| Quyền | Vì sao cần | Cách hạn chế phạm vi |
|---|---|---|
| `storage` | Lưu trữ cấu hình người dùng, nhật ký hành động (actions), bộ ngắt mạch an toàn (breaker) và trạng thái tab | Chỉ lưu cục bộ trên trình duyệt, không gửi ra ngoài |
| `*://*.youtube.com/*`<br>`*://youtube.com/*` | Cho phép Content Script hoạt động trên YouTube để quan sát video | Không dùng `<all_urls>`, tuyệt đối không xin quyền trên các trang web khác |

## Quyền tuyệt đối KHÔNG sử dụng:
- `tabs`, `cookies`, `webRequest`, `history`: Không cần thiết cho tính năng lọc quảng cáo nên kiên quyết không xin.
- Mã thực thi từ xa (`eval`, `script injection` ngoài): Bị cấm hoàn toàn bởi Manifest V3.

## Quy trình khi cần thêm quyền mới:
Mọi quyền mới phải được khai báo trong `ALLOWED_PERMISSIONS` của `tests/unit/manifest.test.ts` và giải trình rõ lý do trong tài liệu này trước khi được merge vào `main`.
# 🔒 Thẩm Định Quyền Manifest V3 (Least Privilege Review)

| Quyền (Permission) | Lý do sử dụng | Biện pháp giảm thiểu rủi ro bảo mật |
| :--- | :--- | :--- |
| `declarativeNetRequest` | Chặn các URL tải chunk quảng cáo và URL theo dõi ở tầng mạng | Chỉ so khớp theo quy tắc lọc tĩnh; không đọc nội dung request |
| `storage` | Lưu trữ cấu hình bật/tắt của người dùng và số liệu thống kê | Chỉ lưu dữ liệu cục bộ trên máy, không gửi thông tin cá nhân ra ngoài |
| `alarms` | Lên lịch tự động kiểm tra định kỳ sức khỏe bộ lọc | Không tạo vòng lặp vô tận gây hao pin |
| Host: `*://*.youtube.com/*` | Phạm vi chèn content script và defuser | Giới hạn duy nhất trên YouTube, không xin quyền `*://*/*` toàn mạng |