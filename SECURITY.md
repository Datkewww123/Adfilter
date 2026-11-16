# Chính sách Bảo mật & Quyền riêng tư (Security & Privacy Policy)

## 1. Phạm vi & Nguyên tắc Hoạt động
AdFilter (`v3.0.0`) là tiện ích chặn quảng cáo mã nguồn mở cho Chromium và Firefox (Manifest V3), phục vụ mục đích nghiên cứu kỹ thuật, học tập và sử dụng cá nhân. Toàn bộ cơ chế nhận diện, chặn mạng và ẩn quảng cáo chạy **cục bộ ngay trên trình duyệt của người dùng**.

## 2. Cam kết về Quyền riêng tư & Dữ liệu Người dùng
- **Không thu thập dữ liệu cá nhân:** Extension không bao giờ đọc, lưu trữ hay gửi đi thông tin đăng nhập, mật khẩu, cookie, lịch sử duyệt web hay nội dung cá nhân.
- **Lưu trữ cục bộ (`chrome.storage.local` / `session`):** Các tùy chọn bộ lọc, danh sách ngoại lệ (`whitelist`), bộ quy tắc tùy chỉnh (`custom_filter_rules_raw`) và thống kê chặn chỉ nằm trên máy của bạn; bạn có thể xem, xuất JSON hoặc xóa bất cứ lúc nào.
- **Telemetry tắt mặc định (`Opt-in`):** Chỉ gửi thống kê kỹ thuật ẩn danh khi người dùng chủ động bật trong Options và tuân thủ danh sách trường cho phép (`src/core/telemetry.ts`).

## 3. Chính sách An toàn cho Bộ lọc Động & Tệp từ xa (`v3.0.0`)
- **Chỉ cho phép HTTPS công khai (Chống SSRF):** Khi người dùng thêm URL danh sách lọc từ xa trong trang Options, `validateRemoteFilterUrl()` chỉ chấp nhận giao thức `https://` công khai; tự động chặn `http://`, `javascript:`, `file://`, `localhost`, loopback (`127.0.0.0/8`, `::1`), dải mạng nội bộ (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) và link-local (`169.254.0.0/16`). Mỗi tệp từ xa bị giới hạn tối đa `512 KB` và timeout `8 giây`.
- **Không thực thi mã từ xa (No Remote Code Execution):** Dữ liệu tải về từ danh sách lọc **chỉ** được phân tích cú pháp tĩnh thành quy tắc `declarativeNetRequest` hoặc bộ chọn CSS; tuyệt đối không dùng `eval()`, `new Function()` hay nạp script JS từ bên ngoài (tuân thủ nghiêm ngặt Manifest V3).
- **Chống CSS/Selector XSS Injection:** Bộ biên dịch động loại bỏ toàn bộ ký tự/mẫu nguy hiểm (`{`, `}`, `<`, `</style`, `expression(`, `javascript:`) trước khi áp dụng lên DOM; Element Picker thoát đầy đủ ký tự `\` trước `"` trong attribute selector.
- **Cách ly An toàn YouTube:** Mọi quy tắc mạng, dynamic rule, scriptlet và procedural cosmetic từ bộ lọc mở rộng đều tự động loại trừ `youtube.com`, `youtu.be`, `googlevideo.com` và `ytimg.com` khỏi phạm vi can thiệp để bảo toàn luồng phát video và tránh xung đột với Stealth Defuser chuyên dụng.

## 4. Kiểm soát Bảo mật Liên tục
- Mã nguồn được quét tự động bằng **GitHub CodeQL** (`codeql.yml`) và kiểm tra quyền tối thiểu qua `tests/unit/manifest.test.ts` trên mọi Pull Request.

## 5. Báo cáo Lỗ hổng Bảo mật
Nếu bạn phát hiện bất kỳ lỗ hổng bảo mật nào, vui lòng liên hệ trực tiếp với tác giả dự án qua thông tin trên hồ sơ GitHub thay vì mở Issue công khai. Mọi báo cáo sẽ được tiếp nhận và xử lý trong vòng 48 giờ.
