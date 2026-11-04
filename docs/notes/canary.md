# 🐤 ADFILTER CANARY DETECTOR SPECIFICATION

## 1. Giới hạn thực tế của Canary kiểm tra DOM
- **Những gì Canary BẮT ĐƯỢC:**
  - YouTube thay đổi class của Player (ví dụ: đổi `.html5-video-player` thành `.yt-player-v2`).
  - Cấu trúc thanh điều khiển, nút bấm gốc bị thay đổi hoặc gỡ bỏ.
- **Những gì Canary KHÔNG THỂ BẮT:**
  - Quảng cáo xuất hiện nhưng không thể skip (vì không thể ép YouTube luôn phân phối quảng cáo trong môi trường kiểm thử tự động).
  - Khắc phục: Phải dựa vào **Telemetry Metrics** từ người dùng thật (`adfilter_circuit_breaker_trips_total`).

## 2. Chu kỳ kiểm tra
- Content Script định kỳ kiểm tra DOM mỗi 60 giây sau khi xem video.
- Nếu phát hiện cấu trúc sai lệch 3 lần liên tiếp, tự động bắn tín hiệu cảnh báo về `/v1/canary`.