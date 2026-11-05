# 0007: Mỗi lần Triển khai một Thư mục Phát hành (Atomic Release Directories)

## Bối cảnh
Trong diễn tập quay lui đầu tiên ở Tuần 19 (Drill A), bản triển khai giải nén trực tiếp gói `deploy.tgz` đè lên thư mục gốc `/opt/adfilter`. Khi đưa một lỗi cấu hình vào `docker-compose.prod.yml`, kiểm tra sức khỏe `/health` thất bại và script quay lại thẻ ảnh cũ (`IMAGE_TAG=$PREV_TAG`), nhưng `/health` vẫn tiếp tục trả về `503` vì file cấu hình hỏng đã ghi đè mất file cũ (rollback chỉ đúng một nửa).

## Quyết định
Áp dụng mô hình **Thư mục Phát hành Cô lập (Release Directories)** trong [`deploy/deploy.sh`](../../deploy/deploy.sh) và [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml):
- Giải nén mỗi bản phát hành vào `/opt/adfilter/releases/<TAG>/`.
- Dùng tên dự án Compose cố định (`docker compose -p adfilter --env-file /opt/adfilter/.env`) để giữ nguyên mạng và volume dữ liệu PostgreSQL giữa các bản.
- Chỉ khi `/health` trả về `200 OK` mới cập nhật liên kết mềm (symlink) `/opt/adfilter/current` trỏ tới `/opt/adfilter/releases/<TAG>` và dọn các bản cũ (giữ 5 bản gần nhất).
- Khi `/health` thất bại, script đọc thư mục đích của `/opt/adfilter/current` và chạy lại `docker compose up -d` từ chính thư mục của bản tốt trước đó — **quay lui đồng thời cả ảnh Docker lẫn toàn bộ file cấu hình**.

## Hệ quả
- **Tích cực:** Quay lui tự động và thủ công đạt tính nguyên tử 100% (cả code ảnh và cấu hình đều trở về trạng thái ổn định tức thì); vượt qua hoàn toàn bài diễn tập cấu hình hỏng.
- **Đánh đổi:** Tốn thêm một lượng nhỏ dung lượng đĩa để lưu giữ 5 thư mục cấu hình gần nhất (vài trăm KB).

## Phương án đã bỏ
Nhúng cứng toàn bộ file `docker-compose.yml` và cấu hình Prometheus/Grafana vào bên trong ảnh Docker của API (làm ảnh phình to và buộc phải build lại toàn bộ code mỗi khi chỉ sửa một ngưỡng cảnh báo Grafana).
