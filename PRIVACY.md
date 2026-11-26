# Privacy Policy — AdFilter Browser Extension

**Effective Date:** November 26, 2026  
**Current Version:** `v3.2.0`

## 1. Summary (English — For Chrome Web Store Review)

**AdFilter does NOT collect, transmit, rent, sell, or store externally any personal information, browsing history, or user data.**

1. **100% Local Processing:** All network filtering (`declarativeNetRequest`), cosmetic element hiding, and pop-up protections execute strictly locally inside the user's browser.
2. **Zero Data Collection:** AdFilter does **not** collect personally identifiable information (PII), authentication credentials, cookies, financial data, keystrokes, or web browsing history. No analytics or telemetry data is transmitted from the published browser extension to any external server.
3. **Local Browser Storage Only (`chrome.storage`):** User preferences, whitelisted domains, and custom filter rules are stored exclusively on the user's own device via the browser's built-in `storage` API. Users can modify or clear these settings at any time.
4. **Optional User-Configured Filter Lists:** By default, AdFilter makes **zero** outbound network requests (`remoteFilterUrls` is empty `[]`). Only if a user manually enters a public `https://` filter list URL in the Options page will the browser fetch that plain-text rule list and compile it locally into declarative network and CSS rules (never executing remote code).
5. **Open Source Transparency:** The complete source code is publicly auditable at [https://github.com/Datkewww123/Adfilter](https://github.com/Datkewww123/Adfilter).

---

## 2. Chính sách Quyền riêng tư (Tiếng Việt)

**AdFilter cam kết KHÔNG thu thập, KHÔNG gửi đi, KHÔNG lưu trữ từ xa và KHÔNG chia sẻ bất kỳ dữ liệu cá nhân hay lịch sử duyệt web nào của người dùng.**

1. **Xử lý cục bộ 100%:** Toàn bộ quá trình chặn kết nối quảng cáo (`declarativeNetRequest`), ẩn phần tử quảng cáo và chống tự bật cửa sổ phụ đều diễn ra trực tiếp bên trong trình duyệt trên máy của bạn.
2. **Không thu thập dữ liệu:** Tiện ích phát hành chính thức không gửi bất kỳ dữ liệu thống kê (telemetry), cookie, mật khẩu hay địa chỉ trang web nào về máy chủ bên ngoài.
3. **Lưu trữ cài đặt tại chỗ (`chrome.storage`):** Danh sách trang web tạm dừng (`whitelist`) và quy tắc lọc tùy chỉnh chỉ nằm trên thiết bị của bạn và có thể xóa bất cứ lúc nào.
4. **Danh sách lọc từ xa tùy chọn:** Mặc định tiện ích không tự tải bất kỳ tệp từ xa nào (`remoteFilterUrls: []`). Chỉ khi bạn chủ động dán đường dẫn `https://` danh sách lọc văn bản vào trang Cài đặt, trình duyệt mới tải tệp văn bản đó về biên dịch thành quy tắc tĩnh cục bộ (tuyệt đối không tải hay chạy mã thực thi từ xa).

## 3. Contact / Liên hệ
For privacy questions or security inquiries, please open an issue or contact the maintainer via [https://github.com/Datkewww123/Adfilter](https://github.com/Datkewww123/Adfilter).
