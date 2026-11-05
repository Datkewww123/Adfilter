# Nghiên cứu Tình huống Kỹ thuật: Thiết kế, Kiểm thử & Vận hành AdFilter (Technical Case Study)

## 1. Vấn đề & Ràng buộc Kỹ thuật (Problem & Constraints)

Trình phát video của một ứng dụng đơn trang (SPA) lớn như YouTube là một môi trường biến động liên tục: các phần tử DOM được tái sử dụng khi chuyển trang (`yt-navigate-finish`), thẻ `<video>` dùng chung giữa luồng nội dung chính và luồng quảng cáo, và cấu trúc class/selector có thể thay đổi bất kỳ lúc nào mà không báo trước.

Bài toán đặt ra là xây dựng một tiện ích trình duyệt **Manifest V3** (hỗ trợ cả Chromium và Firefox) cùng hệ thống quan sát và triển khai đám mây thỏa mãn 4 ràng buộc khắt khe:
1. **Không làm hại trình phát (Do No Harm):** Tuyệt đối không được tua nhầm video chính của người dùng, không làm mất tiếng sau quảng cáo, và phải tự động rút lui an toàn (Safe Degradation) nếu trang web bật cảnh báo chống chặn quảng cáo.
2. **Kiểm thử được một cách tất định (Deterministic Testability):** Logic nhận diện và quyết định phải kiểm thử được hàng trăm trường hợp biên trong vài giây mà không phụ thuộc vào trình duyệt thật.
3. **Quyền tối thiểu & Bảo mật quyền riêng tư (Least Privilege & Privacy):** Chỉ xin quyền tối thiểu trên domain mục tiêu; telemetry mặc định tắt và chỉ chấp nhận danh sách trắng các chỉ số vô danh.
4. **Hạ tầng đám mây chi phí thấp & Không bề mặt tấn công mạng (Zero-SSH, Zero Long-Lived Keys):** Quản lý toàn bộ bằng Terraform dưới mức ngân sách 10 USD/tháng, không mở cổng SSH trên máy chủ và không lưu khóa AWS dài hạn trên GitHub.

---

## 2. Kiến trúc Tổng thể (System Architecture)

AdFilter áp dụng mô hình **Phòng thủ theo chiều sâu (Defense-in-Depth)** ở phía trình duyệt kết hợp với kiến trúc **Functional Core, Imperative Shell** và đường ống **Observability + OIDC Continuous Deployment** trên AWS:

- **Lõi quyết định thuần (`src/core/`):** Bao gồm máy trạng thái `detector.ts` (có debounce chống nhiễu), bộ phân loại `classifier.ts`, bộ lập kế hoạch `intervention.ts`, bộ ngắt mạch `circuitBreaker.ts`, hàm xác minh `verify.ts` và các bộ bảo vệ phát lại (`playbackGuard.ts`, `autoplayGuard.ts`). Toàn bộ đều là hàm thuần túy không phụ thuộc DOM.
- **Lớp vỏ trình duyệt (`src/content/`, `src/stealth/`, `src/background/`):** Lớp Stealth (`defuser.ts`, `interceptor.ts`, `visual-mask.ts`, `cosmetic.css`) triệt tiêu sớm cấu hình quảng cáo ở tầng `MAIN` world; `PlayerObserver` và `Actuator` đóng vai trò cầu nối đọc tín hiệu DOM và thực thi khôi phục an toàn.
- **Tầng Quan sát & Hạ tầng (`server/`, `docker/`, `infra/`, `deploy/`):** Fastify API xác thực chặt bằng Zod, lưu trữ vào PostgreSQL, xuất chỉ số Prometheus và kích hoạt cảnh báo tự động trên Grafana; hạ tầng AWS (EC2, ECR, S3, SSM, IAM OIDC, Budgets) được khai báo 100% bằng Terraform.

*(Xem sơ đồ chi tiết tại [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)).*

---

## 3. Ba Quyết định Thiết kế Quan trọng Nhất (Top 3 Architectural Decisions)

1. **Tách biệt hoàn toàn Lõi Thuần khỏi DOM ([ADR-0001](decisions/0001-pure-core.md)):**
   - Thay vì viết logic nhận diện trực tiếp trên các node HTML, mọi trạng thái DOM được ánh xạ thành cấu trúc dữ liệu phẳng `Signals`. Nhờ đó, chúng tôi xây dựng được bộ công cụ `pnpm eval` và `pnpm sweep` chạy offline trên 17 fixtures thực tế chỉ trong < 1 giây và thiết lập cổng chất lượng (Quality Gate) chặn mọi PR làm tụt độ chính xác dưới 90%.
2. **Đóng toàn bộ cổng Inbound trên EC2, quản trị và triển khai 100% qua AWS SSM + OIDC ([ADR-0005](decisions/0005-ssm-not-ssh.md), [ADR-0006](decisions/0006-oidc-not-keys.md)):**
   - Security Group của máy chủ EC2 có đúng 0 quy tắc chiều vào (không mở cổng 22 SSH, không mở cổng 3000 công khai). GitHub Actions nhận quyền tạm thời qua OIDC (ràng buộc chặt với `environment:production`) và gửi lệnh triển khai qua `aws ssm send-command`, triệt tiêu hoàn toàn nguy cơ bị quét cổng hay lộ khóa AWS dài hạn.
3. **Mô hình Thư mục Phát hành Cô lập để Quay lui Nguyên tử cả Ảnh lẫn Cấu hình ([ADR-0007](decisions/0007-release-directories.md)):**
   - Mỗi lần triển khai giải nén vào `/opt/adfilter/releases/<SHA>` và chỉ trỏ symlink `/opt/adfilter/current` sau khi vượt qua kiểm tra sức khỏe `/health`. Khi bản mới lỗi, hệ thống khôi phục lại toàn bộ thư mục của bản tốt trước đó thay vì chỉ đổi thẻ ảnh Docker.

---

## 4. Bảng Số liệu Thực nghiệm (Empirical Engineering Metrics)

Toàn bộ các con số dưới đây được trích xuất trực tiếp từ các báo cáo đo lường và đường ống CI của dự án:

| Chỉ số | Giá trị đo được | Kích thước mẫu & Điều kiện đo | Nguồn bằng chứng |
| :--- | :--- | :--- | :--- |
| **Precision & Recall của Detector trên bộ Fixture** | **Precision = 100.0% (`1.000`)**<br>**Recall = 100.0% (`1.000`)**<br>**F1 = `1.000`** (`0 FP`, `0 FN`) | Mẫu `n = 17` fixtures thực tế (34 kịch bản kiểm thử tự động trên chuỗi tín hiệu). | [`docs/notes/eval-baseline.md`](notes/eval-baseline.md) (Tuần 6) & `pnpm eval` |
| **Số quảng cáo chạy thật (Dogfooding), Tỉ lệ xác minh đạt & Số video bị kẹt** | **53 quảng cáo thực tế**<br>**Xác minh đạt (`verifyOk`): 96.2% (51/53)**<br>**Video chính bị kẹt: `0` (0.0%)** | Mẫu `n = 53` quảng cáo trong các phiên dùng thực tế ở Tuần 9 (42 skippable, 8 non-skippable, 3 bumper). | [`docs/notes/week9-metrics.md`](notes/week9-metrics.md) (Tuần 9) |
| **Thời gian phát hiện sự cố (MTTD) trong 2 lần Diễn tập Chaos Engineering** | **Drill 01 (Hỏng DOM): `~45 giây`**<br>**Drill 02 (Ngắt mạch hàng loạt): `~40 giây`** | 2 kịch bản diễn tập (`n = 20` sự kiện `VERIFY_FAIL` liên tiếp và `n = 5` sự kiện `CIRCUIT_TRIP`), chu kỳ scrape Prometheus 15s + Grafana evaluate 1m. | [`docs/notes/chaos-drill-01.md`](notes/chaos-drill-01.md) & [`docs/notes/chaos-drill-02.md`](notes/chaos-drill-02.md) (Tuần 17) |
| **Thời gian khôi phục hạ tầng từ số 0 (RTO)** | **`6 phút 30 giây` (6.5 phút)** | Đo từ lúc bắt đầu `terraform apply` trên tài khoản trống đến khi `/health` trên EC2 trả về `200 OK` (gồm cả build ảnh ECR mới). | [`docs/notes/rebuild-from-zero.md`](notes/rebuild-from-zero.md) (Tuần 20) |
| **Thời gian Quay lui Tự động & Quay lui Thủ công** | **Tự động: `~60 giây`** (20 lần health check x 3s)<br>**Thủ công: `~45 – 60 giây`** (`workflow_dispatch`) | Thử nghiệm thực tế qua kịch bản cấu hình lỗi (Drill A) và chạy lại với thẻ SHA cũ đã có sẵn trên ECR (bỏ qua bước build). | [`docs/notes/deploy-runbook.md`](notes/deploy-runbook.md) (Tuần 19) |
| **Quy mô Kiểm thử Tự động & Thời gian chạy** | **Client Unit Tests: `34 files / 253 tests`**<br>**Server Tests: `4 files / 12 tests`**<br>**Playwright E2E: `7 kịch bản` (35/35 lần chạy lặp)** | Tổng cộng **272 bài kiểm thử tự động**; unit tests chạy ~11–25s trên máy cá nhân, toàn bộ đường ống GitHub Actions hoàn tất trong ~2–3 phút. | [`.github/workflows/verify.yml`](../.github/workflows/verify.yml) & [`docs/notes/test-coverage.md`](notes/test-coverage.md) |

---

## 5. Những gì Đi sai & Bài học Kỹ thuật Đắt giá (What Went Wrong & Lessons Learned)

1. **Lỗ hổng Quan sát (Observability Blind Spot) khi Can thiệp Không được Kích hoạt:**
   - *Sự cố:* Trong thiết kế cảnh báo ban đầu, chúng tôi dựa vào tốc độ tăng của `VERIFY_FAIL` để biết hệ thống hỏng. Tuy nhiên, nếu YouTube đổi tên cả `#movie_player` và `.ad-showing`, bộ `Detector` sẽ luôn nghĩ là không có quảng cáo (`NONE`), không gọi can thiệp nên `VERIFY_FAIL = 0` và bảng điều khiển hoàn toàn "xanh giả tạo" (Silent Failure).
   - *Bài học & Cách sửa:* Phải bổ sung một kênh kiểm tra độc lập ngoài luồng sự kiện người dùng — đó là lý do bộ dò cấu trúc **Canary (`canary/check.ts`)** và chỉ số `adfilter_canary_ok` ra đời ở Tuần 17 để chủ động kiểm tra sự tồn tại của các vùng neo DOM.
2. **Lỗ hổng "Rollback một nửa" trong Lần Diễn tập Quay lui Đầu tiên (Tuần 19):**
   - *Sự cố:* Khi giải nén gói `deploy.tgz` đè thẳng lên `/opt/adfilter`, một lỗi cấu hình trong `docker-compose.prod.yml` làm `/health` trả về `503`. Dù script `deploy.sh` đã tự động lùi `IMAGE_TAG` về bản cũ, `/health` vẫn chết vì file `docker-compose.prod.yml` hỏng vẫn nằm nguyên trên đĩa.
   - *Bài học & Cách sửa:* Rollback không bao giờ chỉ là rollback Docker image mà phải là **rollback cả trạng thái cấu hình đi kèm**. Chuyển sang mô hình giải nén vào `/opt/adfilter/releases/<TAG>` và dùng symlink `/opt/adfilter/current` đã giải quyết triệt để vấn đề này.
3. **Cảnh báo Quét Bí mật (Secret Scanning) trên Chuỗi Kết nối Mẫu:**
   - *Sự cố:* Việc đặt chuỗi mẫu dạng `postgres://user:pass@postgres:5432/db` hoặc biến fallback trong `docker-compose.yml` đã kích hoạt cảnh báo của GitHub Secret Scanning và GitGuardian dù đó chỉ là mật khẩu giả cho môi trường dev.
   - *Bài học & Cách sửa:* Tuyệt đối không bao giờ viết chuỗi kết nối có dạng `scheme://user:pass@host` trong bất kỳ file nào được theo dõi bởi Git; sử dụng các biến chuẩn `libpq` (`PGHOST`, `PGUSER`, `PGDATABASE`) kết hợp `env_file: [.env]` và xoay ngay lập tức mọi giá trị từng xuất hiện trong lịch sử Git.

---

## 6. Giới hạn Trung thực của Dự án (Honest Limitations)

- **Phạm vi sử dụng cá nhân & Điều khoản dịch vụ:** Dự án chỉ phục vụ mục đích học tập và sử dụng cá nhân trên tài khoản phụ. Can thiệp vào quảng cáo có thể trái với Điều khoản Dịch vụ của YouTube; tiện ích không được đưa lên bất kỳ kho ứng dụng công khai nào.
- **Kích thước mẫu dữ liệu nhỏ:** Bộ 17 fixtures và 53 lần quan sát thực tế đến từ một người dùng tại một khu vực địa lý, chưa bao quát hết mọi định dạng quảng cáo thử nghiệm của YouTube.
- **Chưa tự động sao lưu cơ sở dữ liệu khi hủy hạ tầng (`destroy`):** Dữ liệu sự kiện trong PostgreSQL nằm trên ổ đĩa EBS của EC2 nên sẽ bị xóa khi chạy `terraform destroy` (xem chi tiết tại [`docs/notes/rebuild-from-zero.md`](notes/rebuild-from-zero.md)).

---

## 7. Bước tiếp theo (Future Roadmap)

1. **Sao lưu tự động PostgreSQL lên S3:** Thiết lập cronjob chạy `pg_dump` hàng ngày đẩy bản sao lưu nén lên S3 kèm bài diễn tập khôi phục dữ liệu định kỳ.
2. **Mở rộng E2E đa trình duyệt trên CI:** Đưa bản build Firefox (`dist/firefox/`) vào chạy kiểm thử tự động E2E trên trình duyệt Firefox Headless trong GitHub Actions.
3. **Phát hiện bất thường thống kê (Statistical Anomaly Detection):** Khi tích lũy đủ dữ liệu telemetry qua nhiều tuần, áp dụng kiểm tra độ lệch chuẩn trên tỉ lệ `VERIFY_OK / AD_START` theo khung giờ thay vì chỉ dùng ngưỡng tĩnh.
