# AdFilter — Chrome Extension Lọc Quảng Cáo YouTube

> **Lưu ý & Phạm vi dự án:** AdFilter là dự án mã nguồn mở phục vụ mục đích học tập, nghiên cứu kỹ thuật và thử nghiệm cá nhân cục bộ. Extension **không** được phát hành lên Chrome Web Store. Việc can thiệp vào trình phát video có thể trái với Điều khoản Dịch vụ của YouTube, người dùng nên thử nghiệm trên tài khoản phụ hoặc trình duyệt riêng biệt.

---

## 1. Tổng quan & Kiến trúc dự án

AdFilter được xây dựng theo chuẩn **Chrome Extensions Manifest V3** với triết lý thiết kế **Pure Core Architecture**: toàn bộ logic ra quyết định (nhận diện, tính toán tín hiệu, máy trạng thái, kế hoạch can thiệp) được tách biệt hoàn toàn khỏi API của trình duyệt và DOM. Điều này cho phép kiểm thử 100% bằng Unit Test thuần không cần trình duyệt, tốc độ thực thi siêu tốc và cực kỳ ổn định.

```mermaid
flowchart TD
    subgraph Browser ["Môi trường Trình duyệt (Chrome MV3)"]
        YTP["YouTube Player (DOM & Video Element)"]
        CS["Content Script (Observer, Actuator)"]
        SW["Background Service Worker"]
        POP["Popup UI & Options Page"]
    end

    subgraph PureCore ["Pure Core (Logic thuần túy, 0 phụ thuộc DOM)"]
        SM["Detector State Machine"]
        INT["Intervention Planner"]
        CB["Circuit Breaker"]
        CLS["Progressive Classifier"]
    end

    YTP -->|Signals: .ad-showing, duration, text| CS
    CS -->|Signals| SM
    SM -->|State: AD / NONE| INT
    INT -->|Action: MUTE, SEEK, CLICK| CS
    CB -.->|Kiểm tra an toàn| INT
    CS -->|Tin nhắn trạng thái| SW
    SW <-->|Đồng bộ dữ liệu| POP
    CS -->|Áp dụng can thiệp & khôi phục| YTP
```

- **`src/core/` (Pure Logic):** Các hàm toán học, máy trạng thái `detector.ts`, bộ ngắt mạch `circuitBreaker.ts`, lập kế hoạch `intervention.ts`, bộ phân loại `classifier.ts`, đo số liệu `metrics.ts`.
- **`src/content/`:** Lắng nghe DOM YouTube qua `MutationObserver` (`PlayerObserver`), trích xuất tín hiệu thô (`extractSignals`), và thực thi can thiệp video (`Actuator`).
- **`src/background/`:** Service Worker điều phối vòng đời, truyền thông điệp giữa các tab và popup.
- **`src/popup/` & `src/options/`:** Giao diện điều khiển nhanh và cấu hình chi tiết cho người dùng.

---

## 2. Hướng dẫn cài đặt

Người dùng có thể cài đặt trực tiếp từ bản phát hành đóng gói sẵn:

1. Truy cập mục **[Releases](https://github.com/Datkewww123/Adfilter/releases)** của repository.
2. Tải về file `adfilter-chromium-v0.1.0.zip` và file kiểm tra `SHA256SUMS.txt`.
3. (Tùy chọn) Kiểm tra tính toàn vẹn của file zip bằng PowerShell:
   ```powershell
   Get-FileHash adfilter-chromium-v0.1.0.zip -Algorithm SHA256
   ```
4. Giải nén file zip vào một thư mục cố định trên máy.
5. Mở Google Chrome, truy cập `chrome://extensions/`.
6. Bật công tắc **Developer mode** (Chế độ dành cho nhà phát triển) ở góc trên bên phải.
7. Bấm **Load unpacked** (Tải tiện ích đã giải nén) và chọn thư mục vừa giải nén.

---

## 3. Hướng dẫn sử dụng & Cơ chế an toàn

- **Chế độ Chạy thử an toàn (Dry Run):** Mặc định khi mới cài đặt, extension có thể kích hoạt chế độ dry-run để quan sát và ghi nhận nhật ký phát hiện mà không trực tiếp can thiệp vào video của bạn.
- **Phím tắt khẩn cấp (Kill Switch):** Nhấn tổ hợp phím **`Alt + Shift + K`** bất kỳ lúc nào để bật/tắt tức thời extension trên tab hiện tại.
- **Khôi phục âm lượng & tốc độ:** Khi quảng cáo bắt đầu, extension giảm âm lượng / tua quảng cáo; ngay khi quảng cáo kết thúc, âm lượng và tốc độ ban đầu của người dùng được khôi phục 100%.
- **Ngắt mạch chống chặn (Circuit Breaker):** Khi phát hiện YouTube hiển thị cảnh báo chặn ad-block (`ENFORCEMENT_SEEN`), extension tự động ngắt toàn bộ can thiệp để bảo vệ tài khoản và luồng xem của bạn.
- **Bảo vệ video người dùng:** Tuyệt đối không can thiệp nếu video chính không có nhãn quảng cáo, đảm bảo không bao giờ tua nhầm nội dung người dùng muốn xem.

---

## 4. Lệnh dành cho nhà phát triển

Dự án sử dụng **pnpm** làm trình quản lý gói:

```bash
# Cài đặt toàn bộ thư viện phụ thuộc
pnpm install

# Kiểm tra lỗi cú pháp và kiểu TypeScript
pnpm lint
pnpm typecheck

# Chạy toàn bộ 22 bộ Unit Test (190 bài test)
pnpm test

# Đánh giá độ chính xác nhận diện trên tập 17 dataset thực tế
pnpm eval

# Quét kiểm tra lỗ hổng bảo mật gói phụ thuộc
pnpm audit --prod

# Đóng gói bản phát hành Production (ra thư mục dist/chromium)
pnpm build

# Đóng gói bản dev và chạy kiểm thử E2E Playwright trên Chromium giả lập
pnpm build:dev
pnpm e2e
```

---

## 5. Số liệu chất lượng kiểm thử (Evaluation Baseline)

Độ chính xác của thuật toán nhận diện được đánh giá định kỳ trên tập 17 fixtures thực tế thu thập từ YouTube:

| Chỉ số | Kết quả đạt được | Mục tiêu tối thiểu (Quality Gate) |
|---|:---:|:---:|
| **Precision** (Độ chuẩn xác) | **100.0%** (1.000) | $\ge 90.0\%$ |
| **Recall** (Độ bao phủ) | **100.0%** (1.000) | $\ge 90.0\%$ |
| **F1-Score** | **1.000** | $\ge 0.900$ |
| **False Positives (Báo nhầm)** | **0** | 0 |
| **False Negatives (Bỏ sót)** | **0** | 0 |
| **Unit Test Coverage** | **22 suites / 190 tests pass 100%** | 100% pass |
| **E2E Tests (Playwright)** | **7 scenarios pass 100%** | 100% pass |

---

## 6. Quyền hạn & Bảo mật dữ liệu

AdFilter tuân thủ nguyên tắc quyền tối thiểu (**Least Privilege**):

| Quyền xin cấp | Mục đích sử dụng | Phạm vi giới hạn |
|---|---|---|
| `storage` | Lưu trữ cấu hình người dùng, bộ ngắt mạch và nhật ký hành động cục bộ | Chỉ lưu trong bộ nhớ máy tính người dùng |
| `*://*.youtube.com/*`<br>`*://youtube.com/*` | Cho phép Content Script quan sát DOM trên trang YouTube | Không dùng `<all_urls>`, không chạy trên bất kỳ website nào khác |

- **Tuyệt đối không thu thập dữ liệu:** Không đọc cookie, không đọc lịch sử duyệt web, không gửi bất kỳ dữ liệu nào về máy chủ từ xa.
- Chi tiết xem tại [permissions-review.md](docs/notes/permissions-review.md) và [SECURITY.md](SECURITY.md).

---

## 7. Giấy phép mã nguồn

Dự án được phân phối dưới giấy phép mã nguồn mở **MIT License**. Xem chi tiết tại file [LICENSE](LICENSE).
