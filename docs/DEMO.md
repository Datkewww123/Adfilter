# Kịch bản Trình diễn Dự án 3 Phút (3-Minute Technical Demo Script)

> **Lưu ý Bảo mật Trước Khi Quay Màn hình:**
> - Chỉ sử dụng trình duyệt trên **profile thử nghiệm riêng biệt** (không đăng nhập tài khoản cá nhân chính).
> - Chỉ quay cửa sổ ứng dụng (Window Capture) thay vì quay toàn màn hình (Screen Capture).
> - Tuyệt đối che hoặc không mở các trang hiển thị **AWS Account ID 12 chữ số**, địa chỉ email cá nhân hoặc lịch sử trình duyệt.

---

## Phân cảnh 1 (0:00 – 0:20 | 20 giây): Chế độ Chạy thử An toàn (Dry-Run Mode)
- **Thao tác trên màn hình:**
  1. Mở Popup của AdFilter trên trình duyệt, bật công tắc **Chế độ chạy thử (Dry-run)**.
  2. Mở DevTools Console (lọc theo từ khóa `[AdFilter]`) bên cạnh một video đang có tín hiệu quảng cáo.
  3. Xuất nhật ký hành động JSON từ nút **Xuất log JSON** trên Popup.
- **Lời thuyết minh chính:**
  *"AdFilter được thiết kế với triết lý an toàn là trên hết. Ở chế độ Dry-Run, toàn bộ máy trạng thái Detector và bộ phân loại Classifier vẫn nhận diện chính xác quảng cáo và ghi lại hành động dự kiến (`DRY_RUN`), nhưng hoàn toàn không chạm vào trình phát video."*

---

## Phân cảnh 2 (0:20 – 0:50 | 30 giây): Can thiệp Thực tế, Khôi phục & Phím Khẩn cấp trên Trang E2E
- **Thao tác trên màn hình:**
  1. Chạy lệnh `pnpm e2e` hoặc mở trang giả lập `tests/e2e/fake-youtube/watch.html`.
  2. Quan sát tiện ích tự động tắt tiếng, tăng tốc/bỏ qua quảng cáo và **khôi phục 100% âm lượng cùng tốc độ phát ban đầu** của người dùng ngay khi quảng cáo kết thúc.
  3. Nhấn tổ hợp phím khẩn cấp **`Alt + Shift + K`** (Kill Switch) và kích hoạt thử hộp thoại cảnh báo trang để thấy **Circuit Breaker** tự động ngắt mạch an toàn.
- **Lời thuyết minh chính:**
  *"Khi chuyển sang chế độ can thiệp, Actuator lưu lại baseline của người dùng, xử lý quảng cáo và khôi phục nguyên vẹn âm lượng sau đó. Nếu phát hiện cảnh báo từ trang web hoặc người dùng nhấn phím tắt khẩn cấp `Alt+Shift+K`, bộ ngắt mạch Circuit Breaker lập tức dừng can thiệp để bảo vệ trình phát."*

---

## Phân cảnh 3 (0:50 – 1:20 | 30 giây): Đường ống CI Đa Tầng & Đóng gói Đa Trình duyệt
- **Thao tác trên màn hình:**
  1. Mở tab **GitHub Actions** của repository, hiển thị workflow `Verify` xanh với đầy đủ các job: `verify` (Typecheck, 253 Unit tests, Quality Gate `pnpm eval` đạt Precision = 1.000, Recall = 1.000), `e2e` (7 kịch bản Playwright), `audit`, và `infra` (Terraform fmt, validate, TFLint).
  2. Mở trang **GitHub Releases** hiển thị bản phát hành tự động kèm gói zip cho cả Chromium, Firefox và bảng băm `SHA256SUMS.txt`.
- **Lời thuyết minh chính:**
  *"Mọi thay đổi đều phải vượt qua cổng chất lượng tự động: 34 bộ unit test cho lõi thuần không phụ thuộc DOM, cổng đánh giá độ chính xác trên tập 17 fixtures thực tế, 7 bài test E2E trên trình duyệt thật và kiểm tra tĩnh hạ tầng Terraform."*

---

## Phân cảnh 4 (1:20 – 2:00 | 40 giây): Quan sát Hệ thống (Prometheus/Grafana) & Diễn tập Chaos Drill
- **Thao tác trên màn hình:**
  1. Mở bảng điều khiển **Grafana Dashboard (`AdFilter Observability`)** hiển thị số liệu sự kiện theo thời gian thực, tỉ lệ xác minh thành công và trạng thái Canary.
  2. Chạy script diễn tập `npx tsx scripts/drill-broken-dom.ts` hoặc `npx tsx scripts/drill-circuit-breaker.ts`.
  3. Hiển thị cảnh báo Grafana chuyển sang trạng thái **Firing** và bắn webhook về `/alert-hook` với thời gian phát hiện sự cố (**MTTD ~ 40–45 giây**).
- **Lời thuyết minh chính:**
  *"Để biết ngay khi YouTube đổi giao diện làm gãy selector, hệ thống kết hợp bộ dò cấu trúc Canary và cảnh báo Prometheus/Grafana. Qua hai cuộc diễn tập Chaos Engineering giả lập hỏng DOM và ngắt mạch hàng loạt, thời gian phát hiện trung bình MTTD chỉ mất 40 đến 45 giây."*

---

## Phân cảnh 5 (2:00 – 2:40 | 40 giây): Triển khai Tự động qua OIDC & Tự động Quay lui Nguyên tử
- **Thao tác trên màn hình:**
  1. Mở workflow `.github/workflows/deploy.yml` và file `deploy/deploy.sh`, chỉ rõ cơ chế xác thực **GitHub OIDC** (không dùng khóa AWS dài hạn) và triển khai qua **AWS SSM** (Security Group không mở cổng SSH).
  2. Trình chiếu kết quả diễn tập đưa cấu hình lỗi vào `docker-compose.prod.yml`: kiểm tra sức khỏe `/health` thất bại, script tự động quay lui cả ảnh Docker lẫn file cấu hình về thư mục phát hành `/opt/adfilter/current` trước đó trong ~60 giây, giữ cho `/health` tiếp tục trả về `200 OK`.
- **Lời thuyết minh chính:**
  *"GitHub Actions đăng nhập AWS bằng OIDC ngắn hạn và ra lệnh cho máy chủ EC2 qua SSM mà không mở bất kỳ cổng nào ra Internet. Nhờ mô hình thư mục phát hành `releases/<TAG>`, khi bản mới không vượt qua kiểm tra sức khỏe, cả ảnh Docker lẫn cấu hình đều tự động quay lui nguyên tử về bản tốt trước đó."*

---

## Phân cảnh 6 (2:40 – 3:00 | 20 giây): Dựng lại từ Số 0 bằng Terraform & Chỉ số RTO
- **Thao tác trên màn hình:**
  1. Hiển thị bảng đo thời gian trong [`docs/notes/rebuild-from-zero.md`](notes/rebuild-from-zero.md) từ lúc chạy `terraform destroy`, `terraform apply`, đồng bộ biến `scripts/sync-gh-vars.sh`, kích hoạt `deploy.yml` cho đến khi `/health` trả về `200 OK`.
- **Lời thuyết minh chính:**
  *"Toàn bộ hạ tầng AWS được mô tả 100% bằng Terraform với ngân sách giới hạn 10 USD/tháng. Ngay cả khi xóa sạch toàn bộ hạ tầng tính toán, hệ thống có thể dựng lại hoàn chỉnh từ số 0 và sẵn sàng phục vụ chỉ trong 6 phút 30 giây (RTO = 6.5 phút)."*
