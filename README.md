# AdFilter v3.0.0 — Brave-Style Universal AdFilter (Manifest V3) & Cloud Observability

[![Verify CI](https://github.com/Datkewww123/Adfilter/actions/workflows/verify.yml/badge.svg)](https://github.com/Datkewww123/Adfilter/actions/workflows/verify.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-3.0.0-brightgreen.svg)](CHANGELOG.md)

> **Mô tả & Phạm vi Dự án:** AdFilter là tiện ích chặn quảng cáo đa nền tảng (**Chromium & Firefox Manifest V3**) viết bằng TypeScript, kết hợp **Kiến trúc Lõi Quyết định Thuần (Pure Core)** cho YouTube và **Universal AdBlock Engine kiểu Brave/uBO** cho toàn bộ web (bộ biên dịch filter list ABP/uBO -> Multi-Ruleset DNR + `noop` redirects, Scriptlet Engine `+js`, `attachShadow` Shield trị Closed Shadow DOM, Procedural Engine `:has-text`/`:upward` và Dynamic Filter Updater), đi kèm hệ thống **Observability (Fastify, PostgreSQL, Prometheus, Grafana, Canary)** và hạ tầng **AWS Terraform IaC & OIDC Continuous Deployment**. Dự án phục vụ mục đích học tập, nghiên cứu kỹ thuật phần mềm và sử dụng cá nhân; tham khảo chính sách tại [SECURITY.md](SECURITY.md) và [docs/notes/permissions-review.md](docs/notes/permissions-review.md).

---

## 1. Kiến trúc Tổng thể Hệ thống

Chi tiết kiến trúc, ranh giới tin cậy và các đánh đổi kỹ thuật được mô tả đầy đủ tại **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

```mermaid
flowchart LR
  YT[Trang YouTube] --> CS[Content script]
  CS --> CORE[Loi thuan: detector, planner, classifier]
  CORE --> ACT[Actuator: khoi phuc duoc]
  CS --> BG[Service worker]
  BG --> API[API su kien tren AWS]
  API --> PG[(PostgreSQL)]
  API --> PROM[Prometheus]
  PROM --> GR[Grafana va canh bao]
  CAN[Canary] --> API
  GH[GitHub Actions] -->|OIDC| AWS[(AWS: ECR, S3, SSM, EC2)]
```

### Các Bản ghi Quyết định Kiến trúc (Architecture Decision Records — ADRs):
- **[ADR-0001](docs/decisions/0001-pure-core.md):** Tách Lõi Quyết định Thuần (`src/core/`) khỏi DOM và Chrome API.
- **[ADR-0002](docs/decisions/0002-dry-run-default.md):** Chế độ Chạy thử (`dryRun`) làm công tắc an toàn hạng nhất.
- **[ADR-0003](docs/decisions/0003-circuit-breaker-and-safe-degradation.md):** Bộ Ngắt mạch (`Circuit Breaker`) và Hạ cấp An toàn khi gặp cảnh báo trang.
- **[ADR-0004](docs/decisions/0004-opt-in-telemetry-whitelist.md):** Telemetry Tùy chọn (`Opt-in`) và Lọc Danh sách Trắng Kép.
- **[ADR-0005](docs/decisions/0005-ssm-not-ssh.md):** Quản trị Máy chủ qua AWS SSM Session Manager thay vì Mở Cổng SSH (`0 inbound rules`).
- **[ADR-0006](docs/decisions/0006-oidc-not-keys.md):** Xác thực GitHub Actions với AWS bằng OIDC thay vì Khóa Dài hạn.
- **[ADR-0007](docs/decisions/0007-release-directories.md):** Mỗi lần Triển khai một Thư mục Phát hành (`releases/<TAG>`) để Quay lui Nguyên tử cả Ảnh lẫn Cấu hình.

---

## 2. Bảng Số liệu Kỹ thuật Chính (Key Engineering Metrics)

Chi tiết phân tích kỹ thuật và nguồn đo lường xem tại **[docs/CASE-STUDY.md](docs/CASE-STUDY.md)**.

| Chỉ số | Giá trị đạt được | Nguồn bằng chứng |
| :--- | :---: | :--- |
| **Precision & Recall trên tập Fixtures (`n = 17`)** | **Precision = 100.0% (`1.000`)**<br>**Recall = 100.0% (`1.000`)** (`0 FP`, `0 FN`) | [`docs/notes/eval-baseline.md`](docs/notes/eval-baseline.md) & `pnpm eval` |
| **Phiên dùng thực tế (`n = 53` quảng cáo)** | **Xác minh đạt: 96.2% (51/53)**<br>**Video chính bị kẹt: `0` (0.0%)** | [`docs/notes/week9-metrics.md`](docs/notes/week9-metrics.md) |
| **Quy mô Kiểm thử Tự động** | **56 Unit Test suites (`347 tests`)**<br>**4 Server Test suites (`12 tests`)**<br>**12 kịch bản Playwright E2E** (YouTube, Truyện tranh Closed Shadow DOM, Phim VAST, Tin tức Procedural) | [`docs/notes/test-coverage.md`](docs/notes/test-coverage.md) & [`.github/workflows/verify.yml`](.github/workflows/verify.yml) |
| **Thời gian phát hiện sự cố (MTTD — 2 Chaos Drills)** | **Drill 01 (Hỏng DOM): `~45 giây`**<br>**Drill 02 (Ngắt mạch hàng loạt): `~40 giây`** | [`docs/notes/chaos-drill-01.md`](docs/notes/chaos-drill-01.md) & [`docs/notes/chaos-drill-02.md`](docs/notes/chaos-drill-02.md) |
| **Thời gian Quay lui ( Tự động & Thủ công )** | **`~45 – 60 giây`** (cả Docker image lẫn cấu hình) | [`docs/notes/deploy-runbook.md`](docs/notes/deploy-runbook.md) |
| **Thời gian Khôi phục Hạ tầng từ Số 0 (RTO)** | **`6 phút 30 giây` (6.5 phút)** | [`docs/notes/rebuild-from-zero.md`](docs/notes/rebuild-from-zero.md) |

---

## 3. Hướng dẫn Cài đặt & Sử dụng An toàn

### Cài đặt trên Google Chrome / Chromium:
1. Tải gói `adfilter-chromium-v3.0.0.zip` và `SHA256SUMS.txt` từ trang **[Releases](https://github.com/Datkewww123/Adfilter/releases)** (hoặc chạy `pnpm build` / `pnpm package` để tạo `dist/chromium/` và `release/`).
2. Kiểm tra tính toàn vẹn SHA-256:
   ```powershell
   Get-FileHash adfilter-chromium-v3.0.0.zip -Algorithm SHA256
   ```
3. Mở `chrome://extensions/`, bật **Developer mode**, bấm **Load unpacked** và chọn thư mục đã giải nén (`dist/chromium/`).

### Cài đặt trên Mozilla Firefox:
- Chạy `pnpm build:firefox` để đóng gói vào `dist/firefox/` và xem hướng dẫn nạp tiện ích tại [`docs/notes/firefox-install.md`](docs/notes/firefox-install.md).

### Cơ chế An toàn khi Sử dụng:
- **Chế độ Chạy thử (`Dry-run`):** Có thể bật ngay trong Popup để quan sát nhật ký nhận diện mà không can thiệp vào trình phát.
- **Khôi phục Tự động:** Luôn khôi phục 100% âm lượng và tốc độ phát ban đầu của người dùng ngay khi quảng cáo kết thúc.
- **Phím tắt Khẩn cấp (`Alt + Shift + K`):** Tắt/bật tức thời tiện ích trên tab hiện tại và trả trình phát về trạng thái gốc.
- **Bộ Ngắt mạch (`Circuit Breaker`):** Tự động ngừng can thiệp nếu phát hiện cảnh báo chống chặn quảng cáo từ trang.

---

## 4. Lệnh Dành cho Nhà Phát triển

```bash
# Cài đặt toàn bộ phụ thuộc
pnpm install

# Biên dịch bộ lọc ABP/uBO -> DNR JSON + Cosmetic/Scriptlet Index
pnpm compile:filters

# Chạy một lệnh kiểm tra tổng hợp toàn bộ dự án (Lint + Typecheck + 347 Unit Tests + Quality Gate Eval + Multi-target Build)
pnpm verify:all

# Đóng gói bản Dev và chạy 12 kịch bản kiểm thử đầu cuối Playwright E2E
pnpm build:dev
pnpm e2e

# Đóng gói zip phát hành Chromium & Firefox vào thư mục release/
pnpm package

# Chạy kiểm tra kiểu và bộ test của Telemetry & Canary API Server
pnpm --dir server typecheck
pnpm --dir server test
```

---

## 5. Tài liệu Vận hành, Nghiệm thu & Trình diễn

- **Kiến trúc hệ thống:** **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**
- **Sổ tay xử lý sự cố tổng hợp & Xoay mật khẩu:** **[docs/RUNBOOK.md](docs/RUNBOOK.md)**
- **Sổ tay triển khai CD & Quay lui trên AWS:** **[docs/notes/deploy-runbook.md](docs/notes/deploy-runbook.md)**
- **Tiêu chuẩn hoàn thành & Bằng chứng nghiệm thu (DoD):** **[docs/DONE.md](docs/DONE.md)**
- **Nghiên cứu tình huống kỹ thuật (Case Study):** **[docs/CASE-STUDY.md](docs/CASE-STUDY.md)**
- **Kịch bản trình diễn 3 phút (Demo Script):** **[docs/DEMO.md](docs/DEMO.md)**
- **Cẩm nang chuẩn bị phỏng vấn & CV:** **[docs/notes/interview-prep.md](docs/notes/interview-prep.md)**

---

## 6. Trạng thái Dự án & Chính sách

- **Phiên bản hiện tại:** **`v3.0.0`** (Phát hành ngày `2026-11-16` — xem [CHANGELOG.md](CHANGELOG.md)).
- **Tiến độ đã hoàn thành (Tuần 1 – Tuần 29):**
  - **Tuần 1–20:** Kiến trúc Pure Core YouTube, Circuit Breaker, Canary Observability & AWS Terraform CD.
  - **Tuần 21–25:** Mở rộng Universal Web (Anti-Popup, IAB Heuristic, VAST Interceptor, Element Picker, Vietnamese Manga Shield).
  - **Tuần 26–29 (`v3.0.0`):** Nâng cấp thành **Brave-Style Universal Engine** (Filter Compiler `filters/*.txt`, `noop.*` Redirects, Scriptlet Engine `+js`, `attachShadow` Shield, Procedural Engine `:has-text`/`:upward`, Dynamic DNR & Remote Filter Updater, tách làn an toàn YouTube).
- **Bảo mật & Quyền truy cập:** Xem chi tiết tại **[SECURITY.md](SECURITY.md)** và **[docs/notes/permissions-review.md](docs/notes/permissions-review.md)**.

---

## 7. Giấy phép Mã nguồn

Dự án được phân phối dưới giấy phép mã nguồn mở **MIT License**. Xem chi tiết tại file [LICENSE](LICENSE).
