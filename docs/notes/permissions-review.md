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