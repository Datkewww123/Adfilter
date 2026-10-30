# Hướng dẫn cài đặt AdFilter dùng lâu dài trên Firefox

Extension chưa ký khi nạp qua `about:debugging` chỉ là tạm thời và sẽ bị gỡ bỏ khi tắt Firefox. Dưới đây là các lựa chọn để cài đặt dùng ổn định hàng ngày:

## 1. Dùng Firefox Developer Edition hoặc Firefox Nightly (Khuyến nghị cho cá nhân)
1. Cài đặt **Firefox Developer Edition** hoặc **Firefox Nightly**.
2. Mở trình duyệt, gõ `about:config` vào thanh địa chỉ và bấm "Chấp nhận rủi ro và tiếp tục".
3. Tìm kiếm cờ: `xpinstall.signatures.required`.
4. Nhấp đúp chuột để chuyển giá trị từ `true` thành `false`.
5. Đóng gói extension thành file zip:
   ```bash
   pnpm build:firefox
   pnpm exec web-ext build --source-dir dist/firefox --artifacts-dir dist --filename adfilter-firefox.zip --overwrite-dest
   ```
6. Vào `about:addons` -> Bấm vào biểu tượng bánh răng cài đặt -> Chọn **"Install Add-on From File..."** -> Chọn file `dist/adfilter-firefox.zip`.
7. Extension sẽ được cài vĩnh viễn và không bị xóa khi khởi động lại.

## 2. Ký unlisted trên Mozilla Add-ons (AMO)
1. Đăng ký tài khoản trên [addons.mozilla.org](https://addons.mozilla.org).
2. Tạo API Key và Secret trong trang Developer Settings.
3. Chạy lệnh ký tự động:
   ```bash
   npx web-ext sign --source-dir dist/firefox --api-key=$AMO_JWT_ISSUER --api-secret=$AMO_JWT_SECRET
   ```
4. Mozilla sẽ trả về file `.xpi` đã được ký hợp lệ, có thể cài trực tiếp trên mọi bản Firefox thông thường.