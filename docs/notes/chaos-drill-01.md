# 📋 Báo Cáo Diễn Tập Sự Cố #1: YouTube Thay Đổi DOM

- **Ngày thực hiện:** 2026-11-04
- **Kịch bản:** Giả lập YouTube cập nhật mã nguồn player, khiến selector `video.html5-main-video` không còn tìm thấy.
- **Diễn biến:**
  1. Script Canary phát hiện thiếu phần tử, trả về `ok: false, missing: ['video']`.
  2. Báo cáo gửi lên server tại `POST /canary`.
  3. Metric `adfilter_canary_ok` hạ từ 1 xuống 0.
  4. Grafana rule `YouTube DOM Structure Down` chuyển sang trạng thái Firing sau 15 giây.
  5. Contact point gọi webhook `POST /alert-hook` trên server.
- **Chỉ số MTTD (Mean Time to Detect):** 18.5 giây (Đạt chuẩn < 60 giây).