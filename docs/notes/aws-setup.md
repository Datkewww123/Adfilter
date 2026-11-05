# Hướng dẫn thiết lập tài khoản AWS an toàn (AWS Setup Guide)

## 1. Nguyên tắc cốt lõi: Tuyệt đối không dùng tài khoản Root
- **Tài khoản Root (Root Account):** Có toàn quyền tối cao trên toàn bộ tài khoản AWS (thay đổi thông tin thanh toán, xóa tài khoản, đóng dịch vụ...). Nếu lộ thông tin đăng nhập root, kẻ tấn công có thể chiếm đoạt hoàn toàn tài khoản mà không có cơ chế thu hồi tức thì.
- **Biện pháp áp dụng:**
  - Khóa tài khoản root bằng mật khẩu phức tạp (> 20 ký tự) và bật xác thực 2 lớp bắt buộc (Hardware Token hoặc Authenticator App MFA).
  - Khóa quyền truy cập root, không tạo Access Keys (`aws_access_key_id`) cho root.
  - Sử dụng **IAM Identity Center (AWS SSO)** hoặc người dùng IAM có quyền quản trị được kiểm soát và gán chính sách phân quyền theo nguyên tắc đặc quyền tối thiểu (Least Privilege).

---

## 2. Thiết lập ngân sách & cảnh báo chi phí ban đầu (Billing Alerts)
- **Kích hoạt cảnh báo thanh toán:**
  - Truy cập **AWS Billing & Cost Management Console**.
  - Bật tùy chọn `Receive Billing Alerts`.
- **Thiết lập Budget thủ công đầu tiên:**
  - Loại ngân sách: **Cost Budget**.
  - Ngưỡng giới hạn: **10 USD / tháng**.
  - Cảnh báo: Tự động gửi email thông báo khi chi phí thực tế đạt **80%** (8 USD) và khi chi phí dự báo vượt **100%** (10 USD).
  - Mục đích: Đóng vai trò lớp bảo vệ thứ nhất (First Line of Defense) để ngăn chặn các sự cố quên tắt tài nguyên gây phát sinh chi phí ngoài ý muốn.

---

## 3. Cài đặt và cấu hình công cụ trên máy trạm
Các công cụ cần thiết cho kỹ sư DevOps quản trị hạ tầng:
1. **AWS CLI v2:** Công cụ dòng lệnh tương tác với toàn bộ dịch vụ AWS.
2. **Terraform (v1.11+):** Công cụ Infrastructure as Code (IaC) chuẩn declarative.
3. **Session Manager Plugin:** Thành phần mở rộng cho phép kết nối terminal trực tiếp vào EC2 qua AWS Systems Manager (SSM) mà không cần mở cổng 22 SSH.
4. **TFLint:** Công cụ linter chuyên dụng phát hiện lỗi cú pháp, cấu hình không tối ưu và vi phạm best practices của AWS provider.

---

## 4. Xác thực và kiểm tra môi trường
- Đăng nhập phiên làm việc qua AWS SSO:
  ```bash
  aws configure sso
  aws sso login
  ```
- Kiểm tra danh tính người dùng hiện tại (bắt buộc đảm bảo không phải root):
  ```bash
  aws sts get-caller-identity
  ```
  *(Kết quả trả về UserId, Account ID và ARN dạng `arn:aws:sts::<ACCOUNT_ID>:assumed-role/...` hoặc `arn:aws:iam::<ACCOUNT_ID>:user/...`)*.
- Kiểm tra phiên bản công cụ:
  ```bash
  terraform -version
  tflint --version
  session-manager-plugin --version
  ```
