# Quan sát dry-run

| Quảng cáo | Có nút bỏ qua | Hành động ghi | Đúng lúc | Bất thường |
|---|---|---|---|---|
| 1 | Có (sau 5s) | MUTE_SPEEDUP rồi CLICK_SKIP | Đúng | Không |
| 2 | Không (6s ngắn) | MUTE_SPEEDUP | Đúng | Không |
| 3 | Có (sau 5s) | MUTE_SPEEDUP rồi CLICK_SKIP | Đúng | Không |
| 4 | Có (sau 5s) | MUTE_SPEEDUP rồi CLICK_SKIP | Đúng | Không |
| 5 | Không (15s) | MUTE_SPEEDUP | Đúng | Không |

## Nhận xét
- Cơ chế dry-run hoạt động an toàn tuyệt đối, không can thiệp thực tế vào video.
- Mỗi hành động chỉ phát ra đúng 1 lần duy nhất trong suốt thời gian quảng cáo nhờ mảng `done`.
- Khi nút Skip xuất hiện, hành động CLICK_SKIP được lập tức phát ra.