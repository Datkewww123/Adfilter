# Nhật ký phiên dùng detector

| Video (mô tả chung) | Số quảng cáo thấy | Số AD_START | Độ trễ (ms) | Đếm popup | Bất thường |
|---|---|---|---|---|---|
| Video ca nhạc, 1 quảng cáo có nút skip | 1 | 1 | 220 | 1 | Không |
| Video tin tức ngắn, không quảng cáo | 0 | 0 | - | 0 | Không |
| Video review công nghệ, 2 quảng cáo liên tiếp | 2 | 2 | 195 | 2 | Không |
| Video gaming dài, thử tua tới lui liên tục | 0 | 0 | - | 0 | Debounce lọc nhiễu tốt, không bị nhấp nháy |
| Video podcast, 1 quảng cáo ngắn 6s | 1 | 1 | 210 | 1 | Không |

## Nhận xét
- Độ trễ phát hiện dao động trong khoảng ~180ms - 250ms (rất gần ngưỡng START_DEBOUNCE_MS = 150ms).
- Khi tua video hoặc chuyển giữa 2 quảng cáo, debounce 400ms giữ trạng thái ổn định, popup đếm chính xác.