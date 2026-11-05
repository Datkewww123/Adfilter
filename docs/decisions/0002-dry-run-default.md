# 0002: Chế độ Chạy thử (Dry-Run) và Quan sát Trước khi Can thiệp

## Bối cảnh
Can thiệp trực tiếp vào phần tử `<video>` trên trang web phức tạp như YouTube tiềm ẩn nguy cơ tua nhầm video chính của người dùng nếu bộ nhận diện xảy ra dương tính giả (False Positive) hoặc khi cấu trúc DOM của trang thay đổi bất ngờ.

## Quyết định
Thiết kế chế độ **`dryRun`** làm một công tắc hạng nhất (first-class configuration flag) trong toàn bộ đường ống xử lý (`src/core/intervention.ts` và `src/content/index.ts`):
- Khi `dryRun = true`, toàn bộ chuỗi trích xuất tín hiệu, máy trạng thái `Detector`, bộ phân loại `Classifier` và bộ lập kế hoạch `plan()` vẫn chạy đầy đủ và ghi nhật ký hành động (`DRY_RUN`), nhưng `Actuator` tuyệt đối không chạm vào thuộc tính của thẻ `<video>` hay bấm nút trên DOM.
- Người dùng có thể bật/tắt `dryRun` tức thì ngay trên Popup hoặc trang Options để kiểm tra an toàn ("extension sẽ làm gì") trước hoặc sau khi YouTube cập nhật giao diện.

## Hệ quả
- **Tích cực:** Cho phép thu thập dữ liệu thực tế, kiểm tra độ chính xác của bộ phát hiện và chẩn đoán lỗi trên trang thật mà không gây bất kỳ rủi ro nào làm gián đoạn việc xem video.
- **Đánh đổi:** Cần duy trì kiểm tra nhánh `dryRun` nhất quán ở cả bộ lập kế hoạch lẫn bộ thực thi và kiểm chứng bằng bài test E2E riêng (`tests/e2e/skip.spec.ts`).

## Phương án đã bỏ
Chỉ có một công tắc Bật/Tắt hoàn toàn (`enabled`): khi tắt thì mất luôn khả năng quan sát và ghi log chẩn đoán trạng thái bộ nhận diện.
