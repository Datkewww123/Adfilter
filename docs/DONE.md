# Tiêu chuẩn Hoàn thành Toàn Dự án & Bằng chứng Nghiệm thu (Definition of Done)

Tài liệu này đối chiếu từng tiêu chí hoàn thành (Definition of Done — DoD) của toàn bộ chương trình 20 tuần với bằng chứng xác thực trực tiếp trong kho mã nguồn.

---

## 1. Chất lượng Mã nguồn & Kiểm thử Tự động (Code Quality & Testing)

| Tiêu chí nghiệm thu | Trạng thái | Bằng chứng xác thực (File / Lệnh kiểm tra) |
| :--- | :---: | :--- |
| Lệnh kiểm tra tổng hợp `pnpm verify:all` chạy xanh 100% | ✅ Đạt | [`package.json`](../package.json) (`lint`, `typecheck`, `test`, `eval`, `build`, `build:firefox`) |
| Kiểm tra kiểu tĩnh TypeScript Strict (`noEmit`) cho cả Client và Server (0 lỗi) | ✅ Đạt | [`tsconfig.json`](../tsconfig.json), [`server/tsconfig.json`](../server/tsconfig.json) |
| Bộ Unit Test cho Lõi Thuần & Lớp Vỏ đạt 100% pass (**34 files / 253 tests**) | ✅ Đạt | [`tests/unit/`](../tests/unit/) (`pnpm test`) |
| Bộ Unit & Integration Test cho Telemetry/Canary API Server (**4 files / 12 tests**) | ✅ Đạt | [`server/tests/`](../server/tests/) (`pnpm --dir server test`) |
| Cổng chất lượng Detector (`Quality Gate`) trên tập 17 fixtures thực tế đạt **Precision = 1.000, Recall = 1.000** ($\ge 0.90$) | ✅ Đạt | [`scripts/eval.ts`](../scripts/eval.ts), [`docs/notes/eval-baseline.md`](notes/eval-baseline.md), [`.github/workflows/verify.yml`](../.github/workflows/verify.yml) |
| Kiểm thử đầu cuối Playwright E2E trên Chromium (**7 kịch bản**, 35/35 lần chạy lặp không flaky) | ✅ Đạt | [`tests/e2e/skip.spec.ts`](../tests/e2e/skip.spec.ts), [`tests/e2e/safety.spec.ts`](../tests/e2e/safety.spec.ts), [`docs/notes/test-coverage.md`](notes/test-coverage.md) |

---

## 2. Cơ chế An toàn & Bảo vệ Người dùng (Safety & Privacy Guarantees)

| Tiêu chí nghiệm thu | Trạng thái | Bằng chứng xác thực (File / Bài kiểm thử) |
| :--- | :---: | :--- |
| Hỗ trợ chế độ chạy thử (`dryRun`) có cả Unit Test lẫn E2E Test | ✅ Đạt | [`src/core/intervention.ts`](../src/core/intervention.ts), [`tests/unit/intervention.test.ts`](../tests/unit/intervention.test.ts), [`tests/e2e/skip.spec.ts`](../tests/e2e/skip.spec.ts) |
| Khôi phục nguyên vẹn âm lượng (`muted`) và tốc độ phát (`playbackRate`) sau quảng cáo | ✅ Đạt | [`src/content/actuator.ts`](../src/content/actuator.ts), [`tests/unit/actuator.test.ts`](../tests/unit/actuator.test.ts), [`tests/e2e/safety.spec.ts`](../tests/e2e/safety.spec.ts) |
| Bộ ngắt mạch (`Circuit Breaker`) tự động ngắt khi gặp cảnh báo trang (`ENFORCEMENT_SEEN`) hoặc lỗi liên tiếp | ✅ Đạt | [`src/core/circuitBreaker.ts`](../src/core/circuitBreaker.ts), [`tests/unit/circuitBreaker.test.ts`](../tests/unit/circuitBreaker.test.ts), [`tests/e2e/safety.spec.ts`](../tests/e2e/safety.spec.ts) |
| Phím tắt khẩn cấp `Alt + Shift + K` (Kill Switch) tắt nhanh và khôi phục trình phát | ✅ Đạt | [`src/content/index.ts`](../src/content/index.ts), [`tests/e2e/safety.spec.ts`](../tests/e2e/safety.spec.ts) |
| Kiểm soát chống phình quyền (`Least Privilege`) trong `manifest.json` | ✅ Đạt | [`tests/unit/manifest.test.ts`](../tests/unit/manifest.test.ts), [`docs/notes/permissions-review.md`](notes/permissions-review.md) |
| Telemetry mặc định tắt (`Opt-in`) và lọc danh sách trắng nghiêm ngặt ở cả Client & Server | ✅ Đạt | [`src/core/telemetry.ts`](../src/core/telemetry.ts), [`server/src/schema.ts`](../server/src/schema.ts), [`tests/unit/telemetry.test.ts`](../tests/unit/telemetry.test.ts) |

---

## 3. Đóng gói Đa trình duyệt & Phát hành Tự động (Release & Supply Chain Security)

| Tiêu chí nghiệm thu | Trạng thái | Bằng chứng xác thực (File / Workflow) |
| :--- | :---: | :--- |
| Hỗ trợ đóng gói cho cả **Chromium (`dist/chromium/`)** và **Firefox (`dist/firefox/`)** | ✅ Đạt | [`scripts/build.ts`](../scripts/build.ts), [`scripts/transformManifest.ts`](../scripts/transformManifest.ts), [`tests/unit/transformManifest.test.ts`](../tests/unit/transformManifest.test.ts) |
| Workflow phát hành tự động khi đẩy tag `v*` tạo 2 file `.zip` kèm bảng băm `SHA256SUMS.txt` | ✅ Đạt | [`.github/workflows/release.yml`](../.github/workflows/release.yml) |
| Quét lỗ hổng phụ thuộc (`pnpm audit`), CodeQL và Dependabot tự động | ✅ Đạt | [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml), [`.github/dependabot.yml`](../.github/dependabot.yml), [`SECURITY.md`](../SECURITY.md) |

---

## 4. Hạ tầng Đám mây (Terraform IaC) & Triển khai Liên tục (OIDC CD)

| Tiêu chí nghiệm thu | Trạng thái | Bằng chứng xác thực (File / Báo cáo) |
| :--- | :---: | :--- |
| Remote State trên S3 có mã hóa AES-256, bật Versioning và chặn public access | ✅ Đạt | [`infra/bootstrap/main.tf`](../infra/bootstrap/main.tf), [`infra/backend.tf`](../infra/backend.tf) |
| Máy chủ EC2 không mở cổng SSH (`0 inbound rules`), bắt buộc IMDSv2, truy cập qua AWS SSM | ✅ Đạt | [`infra/network.tf`](../infra/network.tf), [`infra/ec2.tf`](../infra/ec2.tf), [`docs/decisions/0005-ssm-not-ssh.md`](decisions/0005-ssm-not-ssh.md) |
| Xác thực GitHub Actions bằng OIDC với 2 vai trò tách biệt (`plan` chỉ đọc, `deploy` môi trường `production`) | ✅ Đạt | [`infra/oidc.tf`](../infra/oidc.tf), [`.github/workflows/infra-plan.yml`](../.github/workflows/infra-plan.yml), [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) |
| Triển khai theo thư mục phát hành `releases/<TAG>` tự động quay lui cả ảnh lẫn cấu hình khi `/health` lỗi | ✅ Đạt | [`deploy/deploy.sh`](../deploy/deploy.sh), [`docs/notes/deploy-runbook.md`](notes/deploy-runbook.md), [`docs/decisions/0007-release-directories.md`](decisions/0007-release-directories.md) |
| Đã kiểm chứng chu kỳ `destroy -> apply`, phát hiện Drift và đo thời gian khôi phục từ số 0 (**RTO = 6.5 phút**) | ✅ Đạt | [`docs/notes/infra-cycle.md`](notes/infra-cycle.md), [`docs/notes/rebuild-from-zero.md`](notes/rebuild-from-zero.md), [`scripts/sync-gh-vars.sh`](../scripts/sync-gh-vars.sh) |

---

## 5. Quan sát Hệ thống & Diễn tập Sự cố (Observability & Chaos Engineering)

| Tiêu chí nghiệm thu | Trạng thái | Bằng chứng xác thực (File / Báo cáo) |
| :--- | :---: | :--- |
| Bộ dò cấu trúc Canary (`POST /canary`) và chỉ số Prometheus (`adfilter_canary_ok`) | ✅ Đạt | [`canary/evaluate.ts`](../canary/evaluate.ts), [`canary/check.ts`](../canary/check.ts), [`docs/notes/canary.md`](notes/canary.md) |
| Dashboard Grafana & Quy tắc cảnh báo tự động bắn webhook tới `/alert-hook` | ✅ Đạt | [`docker/grafana/provisioning/`](../docker/grafana/provisioning/), [`server/src/app.ts`](../server/src/app.ts) |
| Hoàn thành 2 cuộc diễn tập Chaos Engineering kèm số đo MTTD (`~40–45s`) | ✅ Đạt | [`scripts/drill-broken-dom.ts`](../scripts/drill-broken-dom.ts), [`scripts/drill-circuit-breaker.ts`](../scripts/drill-circuit-breaker.ts), [`docs/notes/chaos-drill-01.md`](notes/chaos-drill-01.md), [`docs/notes/chaos-drill-02.md`](notes/chaos-drill-02.md) |

---

## 6. Tài liệu Kỹ thuật & Rà soát Bí mật (Documentation & Secret Audit)

| Tiêu chí nghiệm thu | Trạng thái | Bằng chứng xác thực (File) |
| :--- | :---: | :--- |
| Tài liệu kiến trúc (`ARCHITECTURE.md`) và đủ **7 bản ghi quyết định thiết kế (`ADR 0001 – 0007`)** | ✅ Đạt | [`docs/ARCHITECTURE.md`](ARCHITECTURE.md), [`docs/decisions/`](decisions/) |
| Runbook xử lý sự cố tổng hợp (`RUNBOOK.md`) và hướng dẫn xoay mật khẩu | ✅ Đạt | [`docs/RUNBOOK.md`](RUNBOOK.md) |
| Kịch bản Demo 3 phút (`DEMO.md`), Case Study (`CASE-STUDY.md`) và Chuẩn bị phỏng vấn (`interview-prep.md`) | ✅ Đạt | [`docs/DEMO.md`](DEMO.md), [`docs/CASE-STUDY.md`](CASE-STUDY.md), [`docs/notes/interview-prep.md`](notes/interview-prep.md) |
| Rà soát kho Git: không chứa `.env`, `terraform.tfvars`, `backend.hcl`, `*.tfstate`, không lộ URL/tiêu đề trong fixtures | ✅ Đạt | Kiểm tra bằng `git ls-files` và [`scripts/check-fixtures.ts`](../scripts/check-fixtures.ts) (`0` file nhạy cảm bị theo dõi) |
