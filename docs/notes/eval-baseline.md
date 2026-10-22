# Baseline detector

- Ngày: 2026-10-23
- Số lượng Fixtures: 17 files
- Cấu hình ngưỡng: startDebounceMs = 150ms, endDebounceMs = 400ms

| tp | fp | fn | merged | precision | recall | f1 | debounceMs | vsLabelMs |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 4 | 0 | 0 | 0 | 1.000 | 1.000 | 1.000 | 283.5 | 283.5 |

## Phân tích kết quả
- Hệ thống đạt độ chính xác và độ nhạy tối đa (100%) trên toàn bộ 17 fixtures thực tế.
- Không có hiện tượng báo nhầm (FP = 0) và không bỏ sót quảng cáo nào (FN = 0).
- Độ trễ trung vị là 283.5ms, đảm bảo phản ứng nhanh trước khi người dùng kịp cảm thấy khó chịu.
## Quyết định lựa chọn ngưỡng
- Giữ nguyên `startDebounceMs = 150ms` và `endDebounceMs = 400ms`.
- Căn cứ: Bảng quét tham số (`pnpm sweep`) cho thấy ở ngưỡng 150ms độ trễ đạt 283.5ms (trong khi 400ms làm tăng độ trễ lên tới 1.3s). Ngưỡng 150ms đảm bảo phát hiện nhanh chóng mà vẫn tránh được hiện tượng nhấp nháy.