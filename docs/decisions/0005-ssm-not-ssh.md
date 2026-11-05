# 0005: Quản trị Máy chủ qua AWS SSM Session Manager thay vì Mở Cổng SSH (Zero-Inbound Security Group)

## Bối cảnh
Máy chủ EC2 truyền thống thường mở cổng 22 (SSH) và cổng ứng dụng (3000/3001) ra Internet. Ngay khi một địa chỉ IP công khai mở cổng 22, các mạng botnet tự động trên Internet sẽ quét và tấn công vét cạn (brute-force) liên tục, đồng thời đòi hỏi phải quản lý, lưu trữ và xoay vòng cặp khóa SSH (`*.pem`).

## Quyết định
Thiết kế Security Group `adfilter-app` trong [`infra/network.tf`](../../infra/network.tf) **không có bất kỳ quy tắc Inbound (chiều vào) nào** (`0 inbound rules`), chỉ cho phép kết nối chiều ra (`egress`) tới HTTPS:
- Gắn vai trò IAM `AmazonSSMManagedInstanceCore` cho máy chủ EC2 để kết nối chủ động từ bên trong ra dịch vụ **AWS Systems Manager (SSM)**.
- Mọi thao tác đăng nhập terminal (`aws ssm start-session`), chạy script triển khai từ GitHub Actions (`aws ssm send-command`) và kết nối tới API/Grafana (`AWS-StartPortForwardingSession`) đều đi qua kênh SSM được xác thực bằng IAM.

## Hệ quả
- **Tích cực:** Bề mặt tấn công mạng từ Internet bằng 0; không cần tạo, lưu trữ hay sợ lộ file khóa `ssh.pem`; mọi lệnh thực thi đều được ghi vết kiểm toán trong AWS CloudTrail và SSM Command History.
- **Đánh đổi:** Để gửi telemetry từ trình duyệt cá nhân về máy chủ trên AWS, người dùng cần chạy lệnh chuyển cổng SSM (`localhost:3000`) trên máy trạm.

## Phương án đã bỏ
Mở cổng 22 giới hạn theo IP cá nhân (IP nhà mạng thường xuyên thay đổi động mỗi khi khởi động lại modem, phải sửa tay Security Group gây ra Configuration Drift).
