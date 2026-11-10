# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-11-11

### Added
- **AdFilter Universal Edition — Chặn quảng cáo toàn diện Web Đọc Truyện & Web Phim:**
  - **Mạng lưới DeclarativeNetRequest (DNR):** Hơn 200 quy tắc chặn domain mạng quảng cáo rác, pop-up, cờ bạc, 18+ (Adsterra, PropellerAds, PopAds, ExoClick, MGID...).
  - **Anti-Popup & Anti-Redirect Engine:** Bẫy `window.open`, `location.assign`, `location.replace` trong `MAIN` world, triệt tiêu 100% tình trạng click bị nhảy tab hoặc chuyển hướng trang ngoài ý muốn.
  - **Click Hijacking Guard:** Quét dọn các lớp phủ tàng hình (`opacity: 0`, `z-index: 999999`) bẫy click chuột của người dùng.
  - **Bộ lọc mỹ phẩm Heuristic & Sập khoảng trắng:** Nhận diện banner theo kích thước chuẩn IAB, xóa sạch banner cố định (Floating/Sticky ads) và tự động co rút khoảng trắng thừa về 0px (Zero-Height Collapsing).
  - **Bẻ khóa Anti-Adblock & Tối ưu đọc truyện:** Vô hiệu hóa thư viện FuckAdBlock/BlockAdBlock qua fake `canRunAds` & kích thước mồi; gỡ bỏ modal làm mờ trang; mở khóa chuột phải, sao chép văn bản và bảo vệ cơ chế nạp ảnh lười (`data-src`).
  - **Chặn quảng cáo video Web Phim (VAST/VPAID):** Bẫy các yêu cầu XML VAST/VPAID trả về response rỗng để bỏ qua toàn bộ quảng cáo đệm (preroll ads) trên các player (JWPlayer, Video.js...), đồng thời tự động đóng các overlay quảng cáo giữa phim.
  - **Bật/Tắt theo từng website (Per-Site Whitelist):** Giao diện Popup cho phép người dùng tạm dừng bảo vệ trên các website cá nhân, ngân hàng hoặc trang tin tưởng.
  - **Công cụ chọn phần tử trực quan (Element Zapper):** Cho phép người dùng click trực tiếp vào bất kỳ phần tử nào trên trang web để xóa vĩnh viễn và lưu vào danh sách chặn cá nhân.
  - **Đóng gói phát hành tự động:** Tự động build và đóng gói phân phối định dạng `.zip` sẵn sàng tải lên Chrome Web Store và Firefox Add-ons (`pnpm package`).

## [1.0.0] - 2026-11-06

### Added
- **Hỗ trợ đa trình duyệt & Mobile (Phase 7):**
  - Bộ chuyển đổi thuần `transformManifest` đóng gói đồng thời cho **Chromium (`dist/chromium/`)** và **Firefox Desktop (`dist/firefox/`)**.
  - Mở rộng hỗ trợ giao diện di động `m.youtube.com`, bộ giải phóng khóa cuộn trang (`scrollLock.ts`) và cơ chế bảo vệ luồng phát (`autoplayGuard.ts`, `pauseGuard.ts`, Auto-Resume Guard trong `MAIN` world).
- **Telemetry Tùy chọn & Backend Quan sát (Phase 8):**
  - Hàng đợi sự kiện `ring buffer` và lọc danh sách trắng nghiêm ngặt (`src/core/telemetry.ts`), mặc định tắt (`Opt-in`).
  - Máy chủ **Fastify API + PostgreSQL** (`server/`) xác thực đầu vào bằng Zod `.strict()`, xuất metrics chuẩn **Prometheus** (`/metrics`) và bể chứa webhook cảnh báo (`/alert-hook`).
  - Hệ thống dò cấu trúc chủ động **Canary Detector** (`canary/evaluate.ts`, `canary/check.ts`, `POST /canary`) phát hiện sớm khi YouTube thay đổi DOM.
  - Cấu hình tự động hóa **Grafana Dashboard & Alerting Rules** kèm 2 kịch bản diễn tập Chaos Engineering (`drill-broken-dom.ts`, `drill-circuit-breaker.ts`) đạt MTTD ~40–45s.
- **Hạ tầng Đám mây AWS bằng Terraform & Triển khai Tự động OIDC (Phase 9):**
  - Mã nguồn hạ tầng **Terraform (`infra/`)**: S3 Remote State có mã hóa AES-256 và Versioning, VPC & Security Group **Zero-Inbound (không mở cổng SSH)**, máy chủ EC2 quản trị 100% qua AWS SSM, kho ảnh ECR bất biến (`IMMUTABLE`), ngân sách cảnh báo tự động $10/tháng và CI TFLint.
  - Xác thực **GitHub Actions OIDC** (`infra/oidc.tf`) với 2 vai trò tách biệt (`adfilter-gha-plan` chỉ đọc trên PR và `adfilter-gha-deploy` cho môi trường `production`).
  - Đường ống **Continuous Deployment (`.github/workflows/deploy.yml`, `deploy/deploy.sh`)** theo mô hình thư mục phát hành cô lập (`/opt/adfilter/releases/<SHA>` + symlink `current`), tự động quay lui nguyên tử cả ảnh Docker lẫn cấu hình khi kiểm tra sức khỏe `/health` thất bại, cùng khả năng quay lui thủ công trong 1 phút.
- **Tài liệu Kỹ thuật & Nghiệm thu Toàn diện:**
  - Hoàn thiện [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), 7 bản ghi quyết định thiết kế ([`docs/decisions/0001..0007`](docs/decisions/)), sổ tay sự cố tổng hợp ([`docs/RUNBOOK.md`](docs/RUNBOOK.md)), kịch bản Demo ([`docs/DEMO.md`](docs/DEMO.md)), nghiên cứu tình huống ([`docs/CASE-STUDY.md`](docs/CASE-STUDY.md)), bảng chứng cứ nghiệm thu ([`docs/DONE.md`](docs/DONE.md)) và cẩm nang phỏng vấn ([`docs/notes/interview-prep.md`](docs/notes/interview-prep.md)).

## [0.2.0] - 2026-10-29

### Added
- **Stealth Architecture 3 lớp phòng thủ chuyên sâu (Defense-in-Depth):**
  - **Lớp 1 (Defuser & Interceptor):** Chạy ở `MAIN` world tại `document_start`, thanh lọc triệt để các trường dữ liệu quảng cáo (`adPlacements`, `playerAds`, `adSlots`, `adBreaks`) trong `ytInitialPlayerResponse`, `ytInitialData`, `ytplayer.config` và các request API qua `fetch`/`XMLHttpRequest`.
  - **Lớp 2 (Visual Mask & Cosmetic CSS):** Phủ lớp đen tức thời (< 50ms) và ẩn hoàn toàn phần tử video quảng cáo, banner masthead, promoted video, sponsored Shorts qua CSS `visibility: hidden` và `opacity: 0`.
  - **Lớp 3 (Fast Seek & Actuator Fallback):** Cơ chế One-Shot Seek tua video về cuối trong ~0.05s, kích hoạt sự kiện `ended` và chuyển tiếp luồng phát tự nhiên.
- **Hardening & Chống gỡ bẫy:**
  - Bọc bảo vệ `Object.defineProperty` ngăn YouTube ghi đè hoặc loại bỏ getter/setter hook.
  - Ngụy trang hàm Native (`disguise`) cho `fetch` và `JSON.parse` bảo vệ tính toàn vẹn khi trang web kiểm tra `toString()`.
- **Hỗ trợ toàn diện YouTube Shorts & Mid-roll:**
  - Lọc bỏ `reelWatchEndpoint.ad` trong các feed phản hồi Shorts.
  - Triệt tiêu `adBreaks` loại bỏ gián đoạn giữa chừng video.
- **Runtime Selector Watchdog:**
  - Giám sát định kỳ các selector trọng yếu và kiểm tra rò rỉ dữ liệu quảng cáo.
  - Tự động kích hoạt cơ chế Fallback khi phát hiện thay đổi cấu trúc từ phía YouTube.
- **Tự động giải phóng cảnh báo:**
  - Tự động phát hiện và xóa sạch hộp thoại cảnh báo chặn ad-block (`enforcement dialog`) và thông báo gián đoạn (`interruption popups`).

## [0.1.0] - 2026-10-28

### Added
- Phát hiện quảng cáo bằng State Machine có cơ chế debounce tín hiệu (Precision 100%, Recall 100%).
- Can thiệp an toàn với chế độ chạy thử (dry-run), xác minh hiệu lực và khôi phục âm lượng, tốc độ phát ban đầu.
- Bộ ngắt mạch an toàn (Circuit Breaker) tự động dừng can thiệp khi phát hiện trang bật cơ chế chống ad-block.
- Phím tắt khẩn cấp `Alt+Shift+K` để tắt/bật nhanh extension.
- Giao diện Popup đầy đủ: theo dõi trạng thái tab theo thời gian thực, công tắc tính năng, xuất nhật ký hành động JSON.
- Trang cài đặt mở rộng (Options Page) cấu hình chế độ can thiệp và ngưỡng phát hiện.
- Hệ thống kiểm thử toàn diện: 22 bộ Unit Tests (190 tests) và kiểm thử đầu cuối E2E với Playwright trên Chromium.
- Quy trình CI tự động hóa: kiểm tra kiểu TypeScript, unit test, đánh giá chất lượng (eval Quality Gate), quét lỗ hổng bảo mật (CodeQL, pnpm audit), phát hành tự động qua GitHub Release khi gắn tag.
