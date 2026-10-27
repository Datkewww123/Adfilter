# Bảng độ phủ kiểm thử (Test Coverage Matrix)

| Hành vi & Tính năng | Tầng Unit Test | Tầng E2E Test | Thủ công |
|---|---|---|---|
| Nhận diện trạng thái quảng cáo (State Machine) | `detector.test.ts`, `detector.fixtures.test.ts` | `skip.spec.ts` | Đạt |
| Tự bấm nút Skip (Click Simulator) | `actuator.test.ts` | `skip.spec.ts` | Đạt |
| Chế độ Dry-run (Không đụng DOM) | `intervention.test.ts` | `skip.spec.ts` | Đạt |
| Tắt tiếng & Tua nhanh khi gặp quảng cáo | `actuator.test.ts`, `verify.test.ts` | `safety.spec.ts` | Đạt |
| Khôi phục âm lượng & Tốc độ gốc người dùng | `actuator.test.ts` | `safety.spec.ts` | Đạt |
| Phát hiện cảnh báo chống adblock & Ngắt mạch | `circuitBreaker.test.ts` | `safety.spec.ts` | Đạt |
| Phím tắt khẩn cấp `Alt+Shift+K` | - | `safety.spec.ts` | Đạt |
| Phân loại loại quảng cáo & Độ tin cậy | `classifier.test.ts`, `adCounter.test.ts` | - | Đạt |