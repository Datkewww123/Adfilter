# 0004: Telemetry Tùy chọn (Opt-In) và Danh sách Trắng Trường Dữ liệu (Strict Whitelist)

## Bối cảnh
Để vận hành hệ thống quan sát (Prometheus/Grafana) phát hiện sớm khi bộ chặn gặp lỗi, tiện ích cần gửi các sự kiện trạng thái (`AD_START`, `VERIFY_OK`, `VERIFY_FAIL`, `CIRCUIT_TRIP`) về máy chủ API. Tuy nhiên, tiện ích chạy trên trình duyệt rất dễ làm lộ thông tin cá nhân nếu vô tình gửi URL trang web, ID video đang xem hoặc định danh người dùng.

## Quyết định
Áp dụng hai lớp bảo vệ quyền riêng tư nghiêm ngặt:
1. **Mặc định Tắt (Strict Opt-In):** Cờ `telemetryEnabled` mặc định là `false`. Không có bất kỳ gói tin mạng nào được gửi đi nếu người dùng không chủ động bật trong trang Options.
2. **Lọc Danh sách Trắng Kép (Dual Whitelist Sanitization):**
   - Ở phía Client (`src/core/telemetry.ts`): Hàm `toTelemetryEvent()` chỉ trích xuất đúng các trường số học và enum trạng thái (`ts`, `kind`, `action`, `adKind`, `verifyOk`, `durationMs`, `extensionVersion`).
   - Ở phía Server (`server/src/schema.ts`): Schema Zod sử dụng `.strict()` từ chối ngay lập tức (`HTTP 400`) bất kỳ payload nào chứa trường lạ chưa khai báo.

## Hệ quả
- **Tích cực:** Đảm bảo 100% không bao giờ rò rỉ lịch sử xem video, URL hay dữ liệu cá nhân lên máy chủ hoặc cơ sở dữ liệu PostgreSQL.
- **Đánh đổi:** Khi một quảng cáo cụ thể gây lỗi, kỹ sư không biết tự động đó là video nào mà cần dùng bộ ghi `Recorder` cục bộ để xuất fixture tái hiện.

## Phương án đã bỏ
Gửi kèm `window.location.href` hoặc `document.title` trong sự kiện telemetry để dễ debug (vi phạm nghiêm trọng nguyên tắc bảo mật quyền riêng tư).
