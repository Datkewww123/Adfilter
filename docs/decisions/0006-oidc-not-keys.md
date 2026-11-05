# 0006: Xác thực GitHub Actions với AWS bằng OIDC thay vì Khóa Truy cập Dài hạn

## Bối cảnh
Để GitHub Actions tự động chạy `terraform plan`, đẩy ảnh Docker lên ECR và triển khai lên EC2, cách làm cũ là tạo một IAM User kèm cặp khóa tĩnh `AWS_ACCESS_KEY_ID` và `AWS_SECRET_ACCESS_KEY` rồi lưu vào GitHub Secrets. Khóa dài hạn không tự hết hạn nên nếu bị rò rỉ sẽ cho phép kẻ tấn công truy cập trái phép vào tài khoản AWS từ bất kỳ đâu.

## Quyết định
Triển khai xác thực liên kết **OpenID Connect (OIDC)** trong [`infra/oidc.tf`](../../infra/oidc.tf):
- Đăng ký `https://token.actions.githubusercontent.com` làm Identity Provider trong IAM.
- Tách thành 2 IAM Roles với điều kiện tin cậy (`Condition`) kiểm tra chặt cả `aud` (`sts.amazonaws.com`) lẫn `sub`:
  1. `adfilter-gha-plan`: Chỉ cho phép khi `sub` khớp `repo:OWNER/REPO:pull_request` và chỉ cấp quyền đọc (`ReadOnlyAccess`).
  2. `adfilter-gha-deploy`: Chỉ cho phép khi `sub` khớp `repo:OWNER/REPO:environment:production` và chỉ cấp đúng các quyền đẩy ECR, ghi S3 `deploy/*` và gửi lệnh SSM tới đúng Instance ID của máy chủ.

## Hệ quả
- **Tích cực:** Không tồn tại bất kỳ khóa truy cập AWS dài hạn nào trên GitHub (`gh secret list` trống hoàn toàn); token tạm thời tự động hết hạn ngay sau khi job kết thúc; PR chưa được gộp không bao giờ có quyền triển khai hay sửa đổi hạ tầng.
- **Đánh đổi:** Cần cấu hình chính xác tên repository (phân biệt chữ hoa/thường) và tạo môi trường `production` trên GitHub.

## Phương án đã bỏ
Lưu `AWS_ACCESS_KEY_ID` và `AWS_SECRET_ACCESS_KEY` trong GitHub Repository Secrets.
