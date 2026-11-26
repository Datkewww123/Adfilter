# Chính sách Bảo mật & Quyền riêng tư (Security & Privacy Policy)

> Đối với chính sách quyền riêng tư song ngữ dùng cho Chrome Web Store / Firefox Add-ons, xem chi tiết tại **[PRIVACY.md](PRIVACY.md)**.

## 1. Phạm vi & Nguyên tắc Hoạt động
AdFilter (`v3.2.0`) là tiện ích chặn quảng cáo và lọc nội dung mã nguồn mở cho Chromium và Firefox (Manifest V3). Toàn bộ cơ chế nhận diện, chặn mạng và ẩn quảng cáo của tiện ích chạy **100% cục bộ ngay trên trình duyệt của người dùng**.

## 2. Cam kết về Quyền riêng tư & Dữ liệu Người dùng
- **Không thu thập dữ liệu người dùng:** Gói tiện ích phát hành không đọc, lưu trữ từ xa hay gửi đi bất kỳ thông tin đăng nhập, mật khẩu, cookie, lịch sử duyệt web hay dữ liệu telemetry nào của người dùng.
- **Lưu trữ cục bộ (`chrome.storage.local` / `session`):** Các tùy chọn bộ lọc, danh sách ngoại lệ (`whitelist`) và bộ quy tắc tùy chỉnh (`custom_filter_rules_raw`) chỉ nằm trên máy của bạn; bạn có thể chỉnh sửa hoặc xóa bất cứ lúc nào.

## 3. Chính sách An toàn cho Bộ lọc Động & Tệp từ xa
- **Chỉ cho phép HTTPS công khai (Chống SSRF):** Khi người dùng tự thêm URL danh sách lọc từ xa trong trang Options, `validateRemoteFilterUrl()` chỉ chấp nhận giao thức `https://` công khai; tự động chặn `http://`, `javascript:`, `file://`, `localhost`, loopback (`127.0.0.0/8`, `::1`), dải mạng nội bộ (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) và link-local (`169.254.0.0/16`). Mỗi tệp từ xa bị giới hạn tối đa `512 KB` và timeout `8 giây`.
- **Không thực thi mã từ xa (No Remote Code Execution):** Dữ liệu tải về từ danh sách lọc **chỉ** được phân tích cú pháp tĩnh thành quy tắc `declarativeNetRequest` hoặc bộ chọn CSS; tuyệt đối không dùng `eval()`, `new Function()` hay nạp script JS từ bên ngoài (tuân thủ nghiêm ngặt Manifest V3).
- **Chống CSS/Selector XSS Injection:** Bộ biên dịch động loại bỏ toàn bộ ký tự/mẫu nguy hiểm (`{`, `}`, `<`, `</style`, `expression(`, `javascript:`) trước khi áp dụng lên DOM; Element Picker thoát đầy đủ ký tự `\` trước `"` trong attribute selector.
- **Cách ly An toàn Trình phát Trực tuyến & Trang Bảo mật:** Tự động cách ly các trang xác thực bảo mật (Cloudflare Turnstile, reCAPTCHA, hCaptcha, OAuth) và luồng truyền phát video để không gây lỗi hiển thị.

## 4. Kiểm soát Bảo mật Liên tục & AI Canary Sentinel
- Mã nguồn được quét tự động bằng **GitHub CodeQL** (`codeql.yml`), kiểm tra quyền tối thiểu qua `tests/unit/manifest.test.ts` trên mọi Pull Request, và giám sát thay đổi cấu trúc DOM từ phía CI/CD thông qua `ai-canary.yml` (hoàn toàn tách biệt khỏi gói tiện ích của người dùng).

## 5. Báo cáo Lỗ hổng Bảo mật
Nếu bạn phát hiện bất kỳ lỗ hổng bảo mật nào, vui lòng liên hệ trực tiếp với tác giả dự án qua hồ sơ GitHub. Mọi báo cáo sẽ được tiếp nhận và xử lý trong vòng 48 giờ.
