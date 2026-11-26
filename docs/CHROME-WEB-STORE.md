# Hướng dẫn Đăng tải lên Chrome Web Store & Kích hoạt AI Canary (v3.2.0)

Tài liệu này tổng hợp đầy đủ **file cần nộp**, **bộ ảnh chuẩn pixel** và **nội dung tiếng Anh copy-paste sẵn** để nộp **AdFilter `v3.2.0`** lên Google Chrome Web Store mà không vướng lỗi xét duyệt.

---

## Phần A — Các bước Đăng tải lên Chrome Web Store

### Bước 1: Chuẩn bị gói `.zip` & Bộ ảnh (Đã tạo sẵn trong Repo)
1. **File tiện ích tải lên Dashboard:**
   - Upload đúng file: **`release/adfilter-chromium-v3.2.0.zip`** *(tuyệt đối không upload source code cả repo)*.
2. **Bộ ảnh chuẩn RGB 24-bit (không kênh Alpha — đúng chuẩn Google):**
   - **Store Icon (`128 × 128`):** `src/icons/icon128.png`
   - **Screenshot (`1280 × 800`):** `docs/store-assets/screenshot-1280x800.png`
   - **Small Promo Tile (`440 × 280`):** `docs/store-assets/promo-440x280.png`

---

### Bước 2: Nội dung điền Tab "Store Listing" (Copy-Paste)
- **Category:** `Productivity` → `Tools` (hoặc `Workflow & Planning`)
- **Language:** `Vietnamese` (hoặc `English`)
- **Detailed Description (Mô tả an toàn, không lạm dụng nhãn hiệu bên thứ ba):**
  ```text
  AdFilter là tiện ích lọc quảng cáo và bảo vệ trải nghiệm duyệt web gọn nhẹ chuẩn Manifest V3.

  Tính năng chính:
  • Chặn kết nối quảng cáo và trình theo dõi bằng cơ chế Declarative Net Request tốc độ cao.
  • Ẩn khung banner cố định (catfish), lớp phủ che nội dung và chặn tự động bật tab quảng cáo (pop-up / pop-under).
  • Công cụ "Chọn để xóa" (Element Picker) cho phép nhấp chọn để ẩn nhanh bất kỳ phần tử gây phiền nhiễu nào trên trang.
  • Nút "Tạm dừng" (Whitelist) bật/tắt nhanh bảo vệ cho từng tên miền chỉ bằng 1 cú nhấp chuột.
  • Hỗ trợ viết quy tắc lọc tùy chỉnh chuẩn cú pháp ABP/uBO.
  • Hoạt động 100% cục bộ trên trình duyệt — không thu thập dữ liệu cá nhân hay lịch sử duyệt web.
  ```

---

### Bước 3: Nội dung điền Tab "Privacy Practices" (Quan trọng nhất để duyệt nhanh)

Hãy copy nguyên văn từng đoạn tiếng Anh dưới đây dán vào đúng ô tương ứng trên Chrome Web Store Developer Dashboard:

#### 1. Single Purpose Description
```text
Block intrusive web advertisements, pop-ups, and page-covering ad overlays while allowing users to customize per-site content filtering rules locally in their browser.
```

#### 2. Permission Justification — `Host permission (<all_urls>)`
```text
Required to apply cosmetic element-hiding stylesheets, block intrusive pop-up/overlay scripts before page render, and run the user-initiated Element Picker tool across any website the user visits, while respecting the user's per-domain whitelist.
```

#### 3. Permission Justification — `declarativeNetRequest`
```text
Required to block known third-party advertising and tracking network requests efficiently using Manifest V3 static rulesets and user-defined dynamic filter rules without intercepting or reading request payloads.
```

#### 4. Permission Justification — `storage`
```text
Required to store user configuration preferences, per-site whitelist domains, and custom filter rules locally on the user's device. No data is synced or transmitted to external servers.
```

#### 5. Are you using remote code?
- Chọn: **`No, I am not using Remote code`**
- *(Nếu có ô giải thích bổ sung)*:
  ```text
  All JavaScript is bundled statically inside the extension package. Optional user-supplied filter lists contain only plain-text domain/CSS selector rules parsed into chrome.declarativeNetRequest rules and CSS selectors; no remote executable code, eval(), or new Function() is ever used.
  ```

#### 6. Data Usage Certification
- **KHÔNG tích** vào bất kỳ ô thu thập dữ liệu nào (vì AdFilter không thu thập dữ liệu).
- Tích đủ **3 ô cam kết** ở cuối trang (*I do not sell user data...*).
- **Privacy Policy URL:**
  ```text
  https://github.com/Datkewww123/Adfilter/blob/main/PRIVACY.md
  ```

---

## Phần B — Cách kích hoạt AI Canary Sentinel trên GitHub (Miễn phí)

Hệ thống `AI Canary Sentinel` (`.github/workflows/ai-canary.yml`) chạy hoàn toàn trên GitHub Actions, không nằm trong gói `.zip` của Chrome Web Store:

1. Truy cập [Google AI Studio](https://aistudio.google.com/apikey) để lấy 1 mã **`GEMINI_API_KEY`** miễn phí.
2. Mở kho GitHub `Adfilter` → **Settings** → **Secrets and variables** → **Actions**:
   - Trong tab **Secrets**, bấm **New repository secret**:
     - Name: `GEMINI_API_KEY`
     - Secret: *(dán khóa API của bạn)*
   - *(Tùy chọn)* Trong tab **Variables**, bấm **New repository variable**:
     - Name: `CANARY_URLS`
     - Value: danh sách các trang bạn muốn canh gác mỗi sáng, cách nhau bằng dấu phẩy (ví dụ: `https://www.youtube.com/watch?v=dQw4w9WgXcQ,https://example-movie-site.com`).
3. Để chạy thử ngay lập tức: vào tab **Actions** trên GitHub → chọn **AI Canary Sentinel** → bấm **Run workflow**. Khi phát hiện trang web cập nhật cấu trúc quảng cáo mới, bot sẽ tự động kiểm tra an toàn và mở **GitHub Issue** đính kèm quy tắc lọc mới cho bạn duyệt!
