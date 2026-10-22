# Thiết kế detector

## Trạng thái
- UNKNOWN: chưa thấy player
- NORMAL: có player, không có quảng cáo
- AD: đang có quảng cáo

## Chuyển trạng thái
- UNKNOWN sang NORMAL hoặc AD: ngay khi thấy player
- NORMAL sang AD: tín hiệu quảng cáo ổn định đủ START_DEBOUNCE_MS (150ms)
- AD sang NORMAL: tín hiệu quảng cáo biến mất đủ END_DEBOUNCE_MS (400ms)

## Điểm số tín hiệu
- adShowing: 3
- adOverlay: 2
- adBadge: 1
Từ 3 điểm trở lên coi là quảng cáo.
> Lý do: nếu YouTube đổi tên class player, lớp phủ cộng huy hiệu vẫn đủ 3 điểm.

## Vì sao debounce
Tín hiệu nhấp nháy khi tua, đổi video, chuyển giữa hai quảng cáo liên tiếp.
Không debounce thì đếm sai số lượng và thời lượng quảng cáo.

## Vì sao hai ngưỡng khác nhau
- Bắt đầu cần nhanh (150ms) để can thiệp sớm.
- Kết thúc cần chậm hơn (400ms) để không cắt đôi một chuỗi quảng cáo liên tục.