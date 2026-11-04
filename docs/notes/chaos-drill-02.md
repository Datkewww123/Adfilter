# 📋 Báo Cáo Diễn Tập Sự Cố #2: Ngắt Mạch Circuit Breaker

- **Ngày thực hiện:** 2026-11-04
- **Kịch bản:** Hệ thống can thiệp thất bại 3 lần liên tiếp, kích hoạt Circuit Breaker chuyển sang trạng thái `OPEN`.
- **Phát hiện quan trọng:**
  - Khi bộ ngắt mạch mở, extension ngưng hoàn toàn các can thiệp để tránh phá hỏng trải nghiệm người dùng.
  - Khi đó, số lần can thiệp thành công dừng lại ở mức 0, khiến tỷ lệ thành công (Success Rate) không còn mẫu số để tính.
  - **Kết luận:** Quy tắc cảnh báo bắt buộc phải dựa vào bộ đếm số lần thất bại tuyệt đối (`adfilter_interventions_total{ok="false"}`), không được chỉ dựa vào tỷ lệ %.