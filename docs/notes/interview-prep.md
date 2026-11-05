# Cẩm nang Chuẩn bị Phỏng vấn Kỹ thuật (Technical Interview Preparation)

Tài liệu này tổng hợp dàn ý trả lời ngắn gọn (dưới 2 phút mỗi câu), bám sát vào bằng chứng thực tế, số liệu đo lường và các bài học xương máu từ quá trình xây dựng **AdFilter**.

---

## 1. Mười Câu hỏi Phỏng vấn Cốt lõi & Dàn ý Trả lời Có Bằng chứng

### Câu 1: Vì sao bạn dùng OIDC cho GitHub Actions thay vì tạo IAM Access Key?
- **Luận điểm chính:**
  - Khóa truy cập dài hạn (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) không tự hết hạn; nếu lộ trong log hoặc rò rỉ khỏi GitHub Secrets, kẻ tấn công có thể sử dụng từ bất kỳ máy nào.
  - Với **OpenID Connect (OIDC)**, GitHub Actions xin một JWT ngắn hạn có chữ ký số cho từng lần chạy job, đổi lấy thông tin xác thực STS tạm thời tự hủy ngay khi job kết thúc (`gh secret list` trống hoàn toàn).
  - Ràng buộc điều kiện tin cậy (`Condition` trong Trust Policy) khóa chặt theo thuộc tính `sub`: vai trò `adfilter-gha-plan` chỉ nhận từ `pull_request` với quyền chỉ đọc (`ReadOnlyAccess`), còn vai trò `adfilter-gha-deploy` chỉ nhận từ `environment:production` sau khi code đã vào `main`.
  - Khi cần thu hồi quyền khẩn cấp, chỉ cần sửa hoặc xóa Trust Policy trong IAM.
- **Bằng chứng trong dự án:** [`infra/oidc.tf`](../../infra/oidc.tf), [`docs/decisions/0006-oidc-not-keys.md`](../decisions/0006-oidc-not-keys.md).

---

### Câu 2: Trong Manifest V3, Background Service Worker bị trình duyệt tắt (terminate) sau 30 giây không hoạt động thì bạn xử lý trạng thái thế nào?
- **Luận điểm chính:**
  - Tuyệt đối không lưu trạng thái quan trọng chỉ trong biến toàn cục (in-memory) của Service Worker vì nó sẽ mất sạch khi worker ngủ.
  - Trạng thái từng tab (`TabStatus`) được lưu vào `chrome.storage.session` (tồn tại xuyên suốt phiên trình duyệt dù Service Worker khởi động lại nhiều lần).
  - Cấu hình người dùng, trạng thái bộ ngắt mạch (`BreakerState`) và hàng đợi sự kiện Telemetry (`ring buffer`) được lưu bền vững trong `chrome.storage.local`.
  - Các tác vụ định kỳ (như đẩy sự kiện telemetry theo lô) không dùng `setInterval` mà dùng `chrome.alarms` API để đánh thức Service Worker đúng chu kỳ.
- **Bằng chứng trong dự án:** [`src/background/index.ts`](../../src/background/index.ts), [`src/storage/breakerStore.ts`](../../src/storage/breakerStore.ts), [`src/storage/config.ts`](../../src/storage/config.ts).

---

### Câu 3: Làm sao bạn biết hệ thống chặn quảng cáo bị hỏng khi YouTube âm thầm đổi giao diện?
- **Luận điểm chính:**
  - Thiết kế **2 lớp phát hiện bổ trợ lẫn nhau**:
    1. **Lớp sự kiện runtime (Grafana Alert trên `VERIFY_FAIL` và `CIRCUIT_TRIP`):** Khi tiện ích phát hiện quảng cáo nhưng nút Skip đổi selector làm can thiệp thất bại liên tiếp, cảnh báo `AdFilterVerifyFailBurst` kích hoạt.
    2. **Lớp dò cấu trúc chủ động (Canary Detector):** Trong diễn tập, chúng tôi nhận ra lỗ hổng: nếu YouTube đổi tên cả `#movie_player` và `.ad-showing`, Detector sẽ luôn báo `NONE` (không có quảng cáo), dẫn đến `VERIFY_FAIL = 0` và bảng điều khiển xanh giả tạo. Do đó, bộ dò [`canary/check.ts`](../../canary/check.ts) chủ động mở trang kiểm tra các selector cốt lõi và cập nhật gauge `adfilter_canary_ok`.
  - Đã thực hiện 2 cuộc diễn tập Chaos Engineering đo thời gian phát hiện sự cố thực tế (**MTTD = 40–45 giây**).
- **Bằng chứng trong dự án:** [`docs/notes/canary.md`](canary.md), [`docs/notes/chaos-drill-01.md`](chaos-drill-01.md), [`docs/notes/chaos-drill-02.md`](chaos-drill-02.md).

---

### Câu 4: Cơ chế Rollback của bạn hoạt động thế nào? Có gặp trục trặc nào khi thử nghiệm không?
- **Luận điểm chính:**
  - Mỗi ảnh Docker đẩy lên ECR được gắn thẻ bằng mã **commit SHA 40 ký tự** với chế độ bất biến (`IMMUTABLE`), đảm bảo một thẻ không bao giờ bị ghi đè.
  - **Sự cố thực tế đã gặp (Drill A):** Ở phiên bản đầu tiên, script giải nén `deploy.tgz` đè thẳng vào `/opt/adfilter`. Khi diễn tập đưa một biến môi trường sai vào `docker-compose.prod.yml`, `/health` trả về `503`. Script tự động đổi `IMAGE_TAG` về bản cũ nhưng `/health` vẫn chết vì file `docker-compose.prod.yml` hỏng vẫn nằm trên đĩa (**rollback chỉ đúng một nửa**).
  - **Cách vá triệt để:** Chuyển sang mô hình **Thư mục phát hành (`releases/<TAG>`)** kèm symlink `/opt/adfilter/current`. Mỗi bản nằm ở một thư mục riêng; khi `/health` thất bại, script gọi `docker compose up -d` từ thư mục đích của symlink `current`, quay lui nguyên tử cả ảnh Docker lẫn cấu hình trong ~60 giây.
- **Bằng chứng trong dự án:** [`deploy/deploy.sh`](../../deploy/deploy.sh), [`docs/notes/deploy-runbook.md`](deploy-runbook.md), [`docs/decisions/0007-release-directories.md`](../decisions/0007-release-directories.md).

---

### Câu 5: Bạn có dùng Machine Learning (ML) để phát hiện quảng cáo không? Vì sao?
- **Luận điểm chính:**
  - **Không dùng ML** ở giai đoạn hiện tại vì 3 lý do kỹ thuật rõ ràng:
    1. Tín hiệu DOM trên trình phát YouTube (`.ad-showing`, `.ad-interrupting`, badge bộ đếm, nút skip) mang tính định danh rất cao; máy trạng thái có trọng số kết hợp debounce 150ms/400ms đã đạt **Precision = 1.000 và Recall = 1.000** trên tập 17 fixtures thực tế.
    2. Hàm thuần chạy dưới `< 1ms`, dễ giải thích (debuggable) 100% khi xảy ra lỗi, không làm nặng bộ nhớ của trình duyệt.
    3. Kích thước mẫu dữ liệu thu thập từ một người dùng còn nhỏ, đưa mô hình ML vào lúc này là over-engineering.
- **Bằng chứng trong dự án:** [`src/core/detector.ts`](../../src/core/detector.ts), [`docs/notes/detector-design.md`](detector-design.md), [`docs/notes/eval-baseline.md`](eval-baseline.md).

---

### Câu 6: Terraform Configuration Drift là gì và bạn đã kiểm chứng nó như thế nào?
- **Luận điểm chính:**
  - **Drift (Trôi cấu hình)** xảy ra khi ai đó sửa trực tiếp tài nguyên trên giao diện AWS Console (ClickOps) làm trạng thái thực tế trên đám mây lệch khỏi mã nguồn `.tf` trong Git.
  - **Kiểm chứng thực tế:** Tôi đã thử mở thủ công cổng 22 (SSH) trong Security Group `adfilter-app` trên giao diện AWS, sau đó chạy `terraform -chdir=infra plan`. Terraform đối chiếu state và lập tức phát hiện quy tắc cổng 22 là phần tử lạ cần xóa (`- ingress port 22`). Chạy `terraform apply` đã tự động thu hồi cổng này, khôi phục thiết kế Zero-Inbound.
- **Bằng chứng trong dự án:** [`docs/notes/infra-cycle.md`](infra-cycle.md), [`infra/network.tf`](../../infra/network.tf).

---

### Câu 7: Bạn quản lý mật khẩu (Database, Grafana) và xoay vòng bí mật (Secret Rotation) như thế nào?
- **Luận điểm chính:**
  - Tuyệt đối không đặt mật khẩu trong Git, không truyền qua biến Terraform (vì sẽ bị lưu dạng rõ trong `terraform.tfstate`).
  - Mật khẩu được khởi tạo trực tiếp vào **AWS SSM Parameter Store** dưới dạng `SecureString` (`/adfilter/postgres_password`, `/adfilter/grafana_password`). Máy chủ EC2 chỉ được cấp quyền IAM đọc đúng nhánh `/adfilter/*` lúc chạy `deploy.sh`.
  - Khi xoay mật khẩu: cập nhật bằng `aws ssm put-parameter --overwrite`, chạy lại workflow `deploy.yml` để cập nhật `/opt/adfilter/.env`, và dùng `grafana cli admin reset-admin-password` / `ALTER USER` cho các volume dữ liệu đã khởi tạo.
- **Bằng chứng trong dự án:** [`docs/RUNBOOK.md`](../RUNBOOK.md), [`infra/ec2.tf`](../../infra/ec2.tf), [`deploy/deploy.sh`](../../deploy/deploy.sh).

---

### Câu 8: Thử thách kỹ thuật lớn nhất bạn gặp phải là gì và bạn đã sai ở đâu?
- **Luận điểm chính (Kể 1 trong 2 câu chuyện thực tế):**
  1. **Xung đột trạng thái Pause/Play trên trình phát YouTube:** Khi chặn quảng cáo ở điểm chèn giữa video (Mid-roll cue point, ví dụ ở giây `0:22`), YouTube gọi ngầm `video.pause()` để chờ nạp quảng cáo nhưng luồng mạng quảng cáo đã bị chặn, khiến video chính bị kẹt ở trạng thái Pause. Ban đầu việc dùng `setInterval` ép `video.play()` làm người dùng không thể bấm tạm dừng video bằng tay. Giải pháp đúng là xây dựng **Auto-Resume Guard** trong `MAIN` world theo dõi sự kiện cử chỉ thật (`e.isTrusted` trên chuột và phím `Space`/`K`): chỉ tự động khôi phục `player.playVideo()` khi lệnh pause xảy ra mà không có thao tác của người dùng trong 1 giây qua.
  2. **Lỗ hổng Rollback một nửa ở Tuần 19:** Nhầm tưởng quay lui chỉ là lùi thẻ Docker image mà quên rằng file `docker-compose.prod.yml` đã bị giải nén đè, dẫn đến việc thiết kế lại mô hình thư mục phát hành `releases/<TAG>`.
- **Bằng chứng trong dự án:** [`src/stealth/defuser.ts`](../../src/stealth/defuser.ts), [`src/core/autoplayGuard.ts`](../../src/core/autoplayGuard.ts), [`deploy/deploy.sh`](../../deploy/deploy.sh).

---

### Câu 9: Dự án chặn quảng cáo này có vấn đề đạo đức hay pháp lý (Terms of Service) không?
- **Luận điểm chính (Trả lời thẳng thắn, không né tránh):**
  - Có: Việc can thiệp vào trình phát để bỏ qua quảng cáo có thể trái với Điều khoản Dịch vụ (ToS) của YouTube và ảnh hưởng đến mô hình doanh thu của nhà sáng tạo nội dung.
  - Chính vì nhận thức rõ điều đó, dự án tuân thủ các giới hạn nghiêm ngặt: **chỉ chạy cục bộ phục vụ mục đích học tập cá nhân trên tài khoản phụ**, **không phát hành lên Chrome Web Store hay Mozilla Add-ons**, không thương mại hóa và không thu thập dữ liệu của người khác.
  - Giá trị cốt lõi của dự án nằm ở kỹ thuật phần mềm: kiến trúc tách lõi thuần, kiểm thử E2E, bộ ngắt mạch an toàn, hạ tầng Terraform không mở cổng SSH và đường ống CD tự động quay lui.
- **Bằng chứng trong dự án:** [`README.md`](../../README.md), [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md), [`docs/CASE-STUDY.md`](../CASE-STUDY.md).

---

### Câu 10: Nếu có thêm 2 tuần hoặc làm lại từ đầu, bạn sẽ thay đổi gì?
- **Luận điểm chính:**
  1. Thiết lập cơ chế **sao lưu tự động PostgreSQL (`pg_dump`) lên S3** theo lịch hàng ngày để bảo toàn dữ liệu telemetry khi thực hiện `terraform destroy` (hiện tại ổ đĩa gắn theo vòng đời EC2).
  2. Đưa bản build **Firefox (`dist/firefox/`) vào chạy E2E tự động trên CI** (hiện tại Playwright E2E trên CI mới chạy trên Chromium).
  3. Tách kho **ECR Repository sang tầng `infra/bootstrap/`** để khi hủy và dựng lại máy chủ EC2 tính toán, không cần phải build và đẩy lại ảnh Docker từ đầu, giúp rút ngắn RTO từ 6.5 phút xuống dưới 2 phút.
- **Bằng chứng trong dự án:** [`docs/notes/rebuild-from-zero.md`](rebuild-from-zero.md), [`docs/CASE-STUDY.md`](../CASE-STUDY.md).

---

## 2. Các Dòng Mô tả Chuẩn cho CV / Resume (Với Số liệu Thực tế)

Bạn có thể sử dụng trực tiếp các gạch đầu dòng (bullet points) sau vào CV (toàn bộ con số đều khớp 100% với bằng chứng trong repo):

- **Kiến trúc & Kiểm thử Extension:** *"Thiết kế và phát triển tiện ích trình duyệt đa nền tảng (Chromium & Firefox Manifest V3) bằng TypeScript theo kiến trúc Functional Core / Imperative Shell với **253 bài unit test (34 test suites)** và **7 kịch bản kiểm thử đầu cuối Playwright E2E**, đạt **100% Precision & Recall** trên bộ dữ liệu fixtures thực tế và **0% tỷ lệ kẹt video** qua 53 phiên kiểm nghiệm."*
- **CI/CD & Tự động Quay lui:** *"Xây dựng đường ống CI/CD trên GitHub Actions xác thực không khóa dài hạn qua **AWS OIDC**, tự động kiểm tra chất lượng, đóng gói phát hành kèm bảng băm SHA-256 và triển khai qua AWS SSM theo mô hình thư mục phát hành cô lập (`releases/<SHA>`), cho phép **tự động quay lui nguyên tử cả Docker image lẫn cấu hình trong 60 giây** khi kiểm tra sức khỏe thất bại."*
- **Hạ tầng Đám mây (IaC) & Bảo mật:** *"Khai báo 100% hạ tầng AWS (VPC, EC2, ECR, S3 Remote State, IAM, Budgets) bằng **Terraform** kiểm định tự động với TFLint; thiết lập kiến trúc bảo mật **Zero-Inbound Security Group (không mở cổng SSH)** quản trị hoàn toàn qua AWS Systems Manager với thời gian khôi phục toàn bộ hệ thống từ số 0 (**RTO**) đạt **6.5 phút**."*
- **Quan sát Hệ thống & Chaos Engineering:** *"Triển khai hệ thống Observability gồm Fastify API, PostgreSQL, Prometheus, Grafana và bộ dò cấu trúc Canary tự động; thực hiện **2 cuộc diễn tập Chaos Engineering** giả lập đứt gãy giao diện DOM và ngắt mạch hàng loạt, đạt thời gian phát hiện sự cố trung bình (**MTTD**) **40–45 giây**."*
