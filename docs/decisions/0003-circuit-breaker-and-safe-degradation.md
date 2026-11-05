# 0003: Bộ Ngắt mạch (Circuit Breaker) và Hạ cấp An toàn (Safe Degradation)

## Bối cảnh
Khi YouTube thay đổi cấu trúc DOM của nút Skip hoặc hiển thị hộp thoại cảnh báo chống chặn quảng cáo (`enforcement`), nếu tiện ích vẫn cố tình lặp lại hành động click hoặc tua liên tục thì sẽ làm kẹt trình phát video, gây tốn CPU hoặc dẫn đến việc tài khoản người dùng bị hạn chế xem video.

## Quyết định
Xây dựng cơ chế **Circuit Breaker (`src/core/circuitBreaker.ts`)** kết hợp nguyên tắc **Hạ cấp An toàn (Safe Degradation)**:
1. Nếu phát hiện cảnh báo chống chặn quảng cáo trên trang (`ENFORCEMENT_SEEN`), bộ ngắt mạch lập tức chuyển sang trạng thái **MỞ (`openUntil` trong 30 phút)** ngay lập tức (`trip`), khôi phục trạng thái trình phát và ngừng mọi hành động can thiệp.
2. Nếu can thiệp thất bại liên tiếp vượt ngưỡng (`MAX_FAILURES = 5`), bộ ngắt mạch tự động mở khóa để bảo vệ trình phát.
3. Cung cấp phím tắt khẩn cấp cứng **`Alt + Shift + K`** để người dùng chủ động ngắt và khôi phục trình phát bất kỳ lúc nào.

## Hệ quả
- **Tích cực:** Đảm bảo nguyên tắc "Không làm hại trình phát" (Do No Harm) — trong trường hợp xấu nhất khi YouTube đổi giao diện, tiện ích tự động lùi về trạng thái thụ động thay vì làm hỏng video của người dùng.
- **Đánh đổi:** Trong thời gian bộ ngắt mạch đang mở, quảng cáo có thể hiển thị bình thường cho đến khi hết thời gian hạ nhiệt hoặc người dùng đặt lại.

## Phương án đã bỏ
Cố gắng thử lại vô hạn (infinite retry loop) hoặc leo thang can thiệp khi gặp lỗi xác minh (dễ gây treo trình duyệt và kẹt video).
