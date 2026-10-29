# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-10-29

### Added
- **Stealth Architecture 3 lớp phòng thủ chuyên sâu (Defense-in-Depth):**
  - **Lớp 1 (Defuser & Interceptor):** Chạy ở `MAIN` world tại `document_start`, thanh lọc triệt để các trường dữ liệu quảng cáo (`adPlacements`, `playerAds`, `adSlots`, `adBreaks`, `playbackTracking`) trong `ytInitialPlayerResponse`, `ytInitialData`, `ytplayer.config` và các request API qua `fetch`/`XMLHttpRequest`.
  - **Lớp 2 (Visual Mask & Cosmetic CSS):** Phủ lớp đen tức thời (< 50ms) và ẩn hoàn toàn phần tử video quảng cáo, banner masthead, promoted video, sponsored Shorts qua CSS `visibility: hidden` và `opacity: 0`.
  - **Lớp 3 (Fast Seek & Actuator Fallback):** Cơ chế One-Shot Seek tua video về cuối trong ~0.05s, kích hoạt sự kiện `ended` và chuyển tiếp luồng phát tự nhiên.
- **Hardening & Chống gỡ bẫy:**
  - Bọc bảo vệ `Object.defineProperty` ngăn YouTube ghi đè hoặc loại bỏ getter/setter hook.
  - Ngụy trang hàm Native (`disguise`) cho `fetch` và `JSON.parse` bảo vệ tính toàn vẹn khi trang web kiểm tra `toString()`.
- **Hỗ trợ toàn diện YouTube Shorts & Mid-roll:**
  - Lọc bỏ `reelWatchEndpoint.ad` trong các feed phản hồi Shorts.
  - Triệt tiêu `adBreaks` và `playbackTracking` loại bỏ gián đoạn giữa chừng video.
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
