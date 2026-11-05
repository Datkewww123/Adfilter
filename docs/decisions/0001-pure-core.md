# 0001: Tách Lõi Quyết định Thuần (Pure Core) khỏi DOM và Chrome API

## Bối cảnh
Trong các tiện ích trình duyệt thông thường, logic phát hiện quảng cáo, đọc phần tử DOM (`document.querySelector`) và gọi lệnh can thiệp (`video.currentTime = ...`, `chrome.storage`) thường bị viết trộn lẫn trong một file content script duy nhất. Cách viết này khiến việc kiểm thử tự động trở nên cực kỳ chậm chạp, dễ gãy (flaky) và không thể chạy đánh giá độ chính xác (Precision/Recall) hàng loạt trên tập dữ liệu thu thập được.

## Quyết định
Áp dụng kiến trúc **Functional Core, Imperative Shell**:
- Toàn bộ logic tính điểm tín hiệu, máy trạng thái nhận diện (`detector.ts`), phân loại quảng cáo (`classifier.ts`), lập kế hoạch can thiệp (`intervention.ts`), bộ ngắt mạch (`circuitBreaker.ts`), xác minh kết quả (`verify.ts`) và canh gác phát lại (`playbackGuard.ts`, `autoplayGuard.ts`) được đặt trong thư mục `src/core/` dưới dạng **các hàm thuần túy (pure functions)** — không import DOM, không gọi `window` hay `chrome.*`.
- Phần giao tiếp với trình duyệt được cô lập mỏng ở `src/content/` (`observer.ts`, `actuator.ts`, `index.ts`) và `src/background/`.

## Hệ quả
- **Tích cực:** 34 bộ unit test (253 bài test) chạy hoàn tất chỉ trong vài giây trên môi trường Node/Vitest; cho phép xây dựng công cụ `pnpm eval` và `pnpm sweep` quét 24 tổ hợp tham số trên tập 17 fixtures thực tế với Precision = 1.000 và Recall = 1.000.
- **Đánh đổi:** Cần định nghĩa rõ các cấu trúc dữ liệu trung gian (`Signals`, `Action`, `DetectorState`) để truyền qua ranh giới giữa lớp vỏ DOM và lõi thuần.

## Phương án đã bỏ
Viết trực tiếp logic quyết định bên trong callback của `MutationObserver` và dùng JSDOM/Playwright cho toàn bộ bài kiểm thử (quá chậm, khó tái hiện chính xác các tình huống biên về thời gian debounce).
