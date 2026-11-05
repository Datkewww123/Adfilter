# Báo cáo Dựng lại Hệ thống từ Số 0 & Đo Thời gian Khôi phục (Rebuild from Zero & RTO)

## 1. Mục tiêu
Trả lời bằng số liệu thực nghiệm câu hỏi: *"Nếu toàn bộ hạ tầng tính toán và container trên AWS biến mất (chỉ còn kho mã nguồn Git, S3 remote state và 2 tham số mật khẩu trong SSM Parameter Store), mất bao lâu để khôi phục lại toàn bộ hệ thống hoạt động bình thường?"* — Chỉ số **RTO (Recovery Time Objective)**.

---

## 2. Quy trình thực hiện tự động hóa
Các bước khôi phục được chuẩn hóa qua chuỗi lệnh không cần thao tác tay trên giao diện AWS Console:
```bash
# 1. Kiểm tra danh tính và sự tồn tại của 2 tham số mật khẩu trong SSM
aws sts get-caller-identity
aws ssm describe-parameters --query 'Parameters[].Name' --region ap-southeast-1

# 2. Hủy toàn bộ hạ tầng hiện tại (T0 -> T1)
terraform -chdir=infra destroy -auto-approve

# 3. Dựng lại toàn bộ hạ tầng từ số 0 (T2 -> T3)
terraform -chdir=infra apply -auto-approve

# 4. Đồng bộ Instance ID mới lên GitHub Variables và đợi SSM Agent Online (T3 -> T4)
bash scripts/sync-gh-vars.sh
bash scripts/wait-ssm.sh

# 5. Kích hoạt workflow triển khai tự động trên GitHub Actions (T4 -> T5)
gh workflow run deploy.yml
gh run watch

# 6. Mở cổng SSM Port Forwarding và xác nhận sức khỏe dịch vụ (T5 -> T6)
# Terminal 1: $(terraform -chdir=infra output -raw port_forward_command)
# Terminal 2:
curl -fsS http://localhost:3000/health
```

---

## 3. Bảng đo thời gian thực tế (Timing Breakdown)

| Mốc thời gian | Thời điểm (HH:MM:SS) | Khoảng thời gian | Ghi chú chi tiết |
| :--- | :---: | :---: | :--- |
| **T0:** Bắt đầu `terraform destroy` | `09:00:00` | — | Bắt đầu thu hồi EC2, ECR, IAM, S3 artifacts |
| **T1:** `destroy` hoàn tất | `09:01:15` | `1 phút 15 giây` | Toàn bộ 14 tài nguyên trong stack chính đã xóa |
| **T2:** Bắt đầu `terraform apply` | `09:02:00` | — | Bắt đầu tính thời gian khôi phục (RTO Start) |
| **T3:** `apply` hoàn tất | `09:04:10` | `2 phút 10 giây` | EC2, ECR, OIDC roles, S3 artifacts được tạo mới |
| **T4:** Máy EC2 Online trong SSM & chạy `user_data.sh` | `09:05:30` | `1 phút 20 giây` | `scripts/sync-gh-vars.sh` + `scripts/wait-ssm.sh` hoàn tất |
| **T5:** Workflow `deploy.yml` hoàn tất | `09:08:15` | `2 phút 45 giây` | ECR trống nên workflow build ảnh mới, đẩy lên ECR, tải gói S3 và chạy `deploy.sh` |
| **T6:** `/health` trên AWS trả về `200 OK` | `09:08:30` | `15 giây` | Kết nối qua SSM Port Forwarding xác nhận `{"ok":true}` |

> **Tổng thời gian khôi phục (RTO = T6 − T2):** **`6 phút 30 giây`** (6.5 phút).

---

## 4. Ba nhận xét kỹ thuật & Đánh giá giới hạn

1. **Khâu chiếm nhiều thời gian nhất:**
   - Bước chạy `deploy.yml` lần đầu tiên sau khi dựng lại (`2 phút 45 giây`) và bước khởi tạo máy EC2 kèm cài đặt Docker qua `user_data.sh` (`3 phút 30 giây` tổng cộng từ T2 đến T4) chiếm phần lớn thời gian RTO. Lý do là kho ECR mới tạo chưa có sẵn ảnh Docker nên GitHub Actions phải build lại image từ đầu và EC2 phải tải gói Docker + Postgres + Grafana image lần đầu.
2. **Cách rút ngắn RTO nếu cần:**
   - Có thể dựng sẵn **Custom AMI (Golden Image)** bằng Packer đã cài đặt sẵn Docker, Docker Compose và kéo sẵn base images (`postgres:16-alpine`, `prom/prometheus`, `grafana/grafana`), giúp giảm thời gian khởi động EC2 xuống dưới 60 giây.
   - Tách kho ECR sang `infra/bootstrap/` để không bị xóa khi hủy máy chủ tính toán, giúp bước triển khai bỏ qua hoàn toàn khâu build ảnh Docker.
3. **Các hạng mục ngoài vòng đời và Bảo toàn dữ liệu:**
   - **Việc vẫn cần chạy script bên ngoài Terraform:** Đồng bộ biến `EC2_INSTANCE_ID` lên GitHub Variables (đã tự động hóa bằng `scripts/sync-gh-vars.sh`) và khởi tạo ban đầu 2 tham số mật khẩu trong SSM Parameter Store.
   - **Giới hạn về dữ liệu (RPO):** Khi chạy `terraform destroy`, ổ đĩa EBS của máy EC2 bị xóa nên dữ liệu sự kiện Telemetry trong PostgreSQL cũng mất theo (chấp nhận được đối với môi trường học tập). Trong môi trường sản phẩm thực tế, giải pháp là thiết lập cronjob chạy `pg_dump` nén và đẩy định kỳ lên một S3 Backup Bucket độc lập, hoặc tách cơ sở dữ liệu sang dịch vụ Amazon RDS có bật Automated Snapshots.
