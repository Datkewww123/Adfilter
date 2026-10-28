# Thiết kế Chiến thuật Tàng hình (Stealth Ad-Blocking)

## 1. Nguyên lý Defuser
YouTube truyền dữ liệu video kèm quảng cáo qua biến `ytInitialPlayerResponse` và API `/youtubei/v1/player`.
Bằng cách bẫy và xóa sạch các trường `adPlacements` và `playerAds` ở giây thứ 0, trình phát YouTube coi video là video không quảng cáo (tương đương YouTube Premium).

## 2. Vì sao không bị phát hiện?
- Không chặn request mạng (`ERR_BLOCKED_BY_CLIENT`).
- Không xóa phần tử DOM gây lỗi cấu trúc.
- Chỉ thanh lọc dữ liệu JSON nội bộ của trang.