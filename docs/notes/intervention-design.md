# Thiết kế can thiệp

## Các mức hành động (từ nhẹ đến mạnh)
1. CLICK_SKIP: Chỉ khi nút bỏ qua đang hiển thị trên màn hình.
2. MUTE_SPEEDUP: Tắt tiếng và tăng tốc video, khôi phục khi hết quảng cáo.
3. SEEK_TO_END: Tua đến cuối (thử nghiệm, mặc định tắt qua `allowSeek`).

## Nguyên tắc an toàn
- Mặc định dry-run (`dryRun: true`).
- Mọi hành động can thiệp phải có khả năng hoàn tác.
- Lỗi lặp lại thì ngắt mạch (Circuit Breaker), không leo thang spam click.
- Có công tắc `enabled: false` để dừng toàn bộ can thiệp ngay lập tức.

## Quyết định kỹ thuật
- `plan()` là hàm thuần, nhận danh sách `done` để tránh thực hiện trùng lặp.
- Circuit Breaker tự ngắt sau 3 lỗi trong 10 phút, thời gian nghỉ (cooldown) là 30 phút.

## Sẽ làm ở Tuần 8
- Bộ thực thi (Actuator), xác minh kết quả và khôi phục trạng thái video.