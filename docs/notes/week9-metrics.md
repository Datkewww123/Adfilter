# Báo cáo số liệu thực tế Tuần 09

| Ngày | Số quảng cáo thấy | executed | verifiedOk | verifiedFail | playbackStuck | enforcementSeen | Ghi chú |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| Ngày 4 | 18 | 18 | 18 | 0 | 0 | 0 | Chạy mượt, không lỗi |
| Ngày 5 | 20 | 20 | 19 | 1 | 0 | 0 | 1 lần mạng chậm |
| Ngày 6 | 15 | 15 | 15 | 0 | 0 | 0 | Đạt mốc 53 quảng cáo |
## Đánh giá & Nghiệm thu Tuần 09:
1. **Vì sao mỗi hành động sinh hai bản ghi?** Bản ghi 1 đánh dấu lúc phát lệnh (`ok`), bản ghi 2 đánh dấu sau khi xác minh trên DOM (`verified`). Tách riêng giúp đo lường chính xác độ trễ và tỉ lệ hiệu quả thực tế.
2. **Vì sao video do người dùng tạm dừng không tính là kẹt?** Vì thuộc tính `paused === true` phản ánh đúng chủ ý của người dùng, không phải do extension làm treo media player.
3. **Vì sao khi thấy cảnh báo của trang cần ngắt mạch dừng lại?** Để tuân thủ an toàn, bảo vệ tài khoản người dùng và tránh bị chặn truy cập.
4. **Mẫu 50 quảng cáo mang lại kết luận gì?** Khẳng định độ ổn định của giải pháp trong đa dạng các loại quảng cáo thực tế (chuỗi ad pods, quảng cáo đơn, interstitial) với 0 lần kẹt video.