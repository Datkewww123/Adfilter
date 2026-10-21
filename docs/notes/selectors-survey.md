# Khảo sát Selector YouTube Player & Quảng cáo

- **Ngày kiểm tra:** 22/10/2026
- **Trình duyệt:** Google Chrome
- **Môi trường:** YouTube Desktop Web (`https://www.youtube.com`)

## Bảng kết quả khảo sát DOM

| Mục đích | Selector / Event | Kết quả kiểm chứng | Ghi chú |
|---|---|---|---|
| Phần tử player chính | `#movie_player` | ✅ Hoạt động chính xác | Khung chứa toàn bộ video player của YouTube |
| Thẻ video HTML5 | `video.html5-main-video` | ✅ Hoạt động chính xác | Phần tử video element phát nội dung |
| Class khi có quảng cáo | `.ad-showing` | ✅ Hoạt động chính xác | Xuất hiện trên `#movie_player` khi quảng cáo đang phát |
| Lớp phủ quảng cáo | `.ytp-ad-player-overlay` | ✅ Hoạt động chính xác | Khung overlay hiển thị thông tin quảng cáo |
| Nút bỏ qua quảng cáo | `.ytp-skip-ad-button` | ✅ Hoạt động chính xác | Nút skip quảng cáo (dùng cho Phase can thiệp) |
| Sự kiện điều hướng SPA | `yt-navigate-finish` | ✅ In log thành công | Kích hoạt mỗi khi người dùng chuyển video mới mà không reload trang |

## Kết luận & Định hướng cho Tuần 3
- Các selector cốt lõi của YouTube Player vẫn duy trì tính ổn định cao.
- Sự kiện `yt-navigate-finish` là chìa khóa để reset trạng thái quan sát khi chuyển video.
- Sẵn sàng dùng các selector này để xây dựng `selectors.ts` và `Signals` ở Ngày 2.
