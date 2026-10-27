# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
