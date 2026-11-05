# Sổ tay Vận hành Triển khai & Quay lui (Deployment & Rollback Runbook)

## 1. Tổng quan Kiến trúc Triển khai Tự động (CD Pipeline)

Hệ thống triển khai tự động của AdFilter tuân thủ nguyên tắc **Zero Long-Lived Credentials** (không lưu trữ khóa truy cập AWS dài hạn trên GitHub) và **Zero Inbound Ports** (không mở cổng SSH vào máy chủ):

```text
Push vào nhánh main (hoặc chạy workflow_dispatch)
  │
  ▼
GitHub Actions (môi trường: production)
  │  OIDC: Đổi JWT ngắn hạn lấy quyền AssumeRole (adfilter-gha-deploy)
  ├─ 1. Build Docker Image → Đẩy lên AWS ECR (tag = commit SHA, IMMUTABLE)
  ├─ 2. Đóng gói cấu hình (deploy.tgz) → Tải lên S3 Artifact Bucket (hạn 30 ngày)
  └─ 3. Gửi lệnh qua AWS SSM SendCommand → Máy chủ EC2 thực thi deploy.sh:
       ├─ Giải nén vào thư mục cô lập /opt/adfilter/releases/<SHA>
       ├─ Đọc mật khẩu từ AWS SSM Parameter Store (/adfilter/*) → tạo /opt/adfilter/.env
       ├─ Kéo ảnh từ ECR và khởi chạy: docker compose -p adfilter up -d --no-build
       ├─ Kiểm tra sức khỏe (Health Check): tối đa 20 lần x 3 giây vào localhost:3000/health
       ├─ Nếu ĐẠT: Cập nhật symlink /opt/adfilter/current → releases/<SHA>, giữ 5 bản mới nhất
       └─ Nếu THẤT BẠI: Tự động quay lui cả ảnh lẫn cấu hình về bản /opt/adfilter/current trước đó
```

---

## 2. Cấu hình Biến trên GitHub (Repository & Environment Variables)

Tất cả các định danh hạ tầng được lưu dưới dạng **GitHub Variables** (không cần dùng Secrets vì xác thực hoàn toàn qua OIDC Trust Policy):

### Biến cấp Environment (`production`):
```bash
gh variable set AWS_DEPLOY_ROLE_ARN --env production --body "$(terraform -chdir=infra output -raw deploy_role_arn)"
gh variable set EC2_INSTANCE_ID --env production --body "$(terraform -chdir=infra output -raw instance_id)"
gh variable set ARTIFACT_BUCKET --env production --body "$(terraform -chdir=infra output -raw artifact_bucket)"
```

### Biến cấp Repository (cho `infra-plan.yml`):
```bash
gh variable set AWS_PLAN_ROLE_ARN --body "$(terraform -chdir=infra output -raw plan_role_arn)"
gh variable set TFSTATE_BUCKET --body "$(terraform -chdir=infra/bootstrap output -raw tfstate_bucket_name)"
gh variable set ALERT_EMAIL --body "alerts@example.com"
```

---

## 3. Quy trình Triển khai Thường lệ (Standard Deployment)

1. Tạo nhánh tính năng/sửa lỗi từ `main`, thực hiện thay đổi và mở Pull Request.
2. Nếu PR có thay đổi trong `infra/**`, workflow `infra-plan.yml` tự động dùng vai trò chỉ đọc (`adfilter-gha-plan`) chạy `terraform plan -lock=false` và đính kèm bản kế hoạch vào phần **Summary** của GitHub Actions.
3. Sau khi toàn bộ CI (`verify`, `e2e`, `audit`, `infra`) xanh, tiến hành **Merge PR vào `main`**.
4. Nếu có thay đổi thuộc `server/**`, `docker/**`, `docker-compose*.yml` hoặc `deploy/**`, workflow `.github/workflows/deploy.yml` sẽ tự động kích hoạt:
   - Nếu môi trường `production` bật chế độ **Required reviewers**, vào tab **Actions** bấm **Review deployments -> Approve and deploy**.
   - Theo dõi tiến trình cho đến khi bước `Trien khai qua SSM va doi ket qua` hoàn tất xanh.

---

## 4. Quy trình Quay lui Thủ công trong 1 Phút (Manual Rollback)

Khi phát hiện bản phát hành hiện tại có lỗi logic hoặc suy giảm hiệu năng cần quay về phiên bản cũ ngay lập tức:

1. **Xác định mã SHA của bản tốt trước đó:**
   - Tra cứu bằng lệnh `git log --oneline -n 10` hoặc xem lịch sử các lần chạy xanh trong tab **Actions**.
2. **Kích hoạt workflow quay lui:**
   - Mở GitHub Repository -> Tab **Actions** -> Chọn workflow **`deploy`** ở cột bên trái.
   - Bấm nút **Run workflow** (góc phải) -> Nhập mã **commit SHA 40 ký tự** của bản tốt vào ô `SHA can trien khai lai` -> Bấm **Run workflow**.
3. **Cơ chế thực thi nhanh:**
   - Vì ảnh Docker gắn thẻ SHA cũ đã có sẵn trên ECR (bất biến `IMMUTABLE`), workflow tự động **bỏ qua bước build** (`Anh <SHA> da co, bo qua build`).
   - Tải lại gói cấu hình `s3://<ARTIFACT_BUCKET>/deploy/<SHA>.tgz` (được lưu giữ 30 ngày) và chạy `deploy.sh <SHA>` trên EC2.
4. **Kiểm tra xác nhận trong phiên SSM:**
   ```bash
   readlink /opt/adfilter/current
   # Kết quả trả về: /opt/adfilter/releases/<SHA_CU>
   curl -fsS http://localhost:3000/health
   ```

---

## 5. Xem Log Triển khai & Chẩn đoán khi Workflow `deploy` Đỏ

### Cách 1: Xem trực tiếp trên GitHub Actions
Khi bước `Trien khai qua SSM va doi ket qua` thất bại, bước tiếp theo **`In log trien khai khi that bai`** (`if: failure()`) sẽ tự động chạy lệnh `aws ssm get-command-invocation` để in toàn bộ `StandardOutputContent` và `StandardErrorContent` từ máy chủ EC2 ra màn hình GitHub Actions.

### Cách 2: Truy vấn log SSM từ máy cá nhân
```bash
aws ssm get-command-invocation \
  --command-id "<CMD_ID>" \
  --instance-id "<EC2_INSTANCE_ID>" \
  --region ap-southeast-1 \
  --query '[Status,StandardOutputContent,StandardErrorContent]' \
  --output text
```

### Cách 3: Vào máy chủ EC2 qua SSM để kiểm tra container
```bash
aws ssm start-session --target <EC2_INSTANCE_ID> --region ap-southeast-1
sudo -u ec2-user bash
cd /opt/adfilter/current
docker compose -p adfilter --env-file /opt/adfilter/.env -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -p adfilter --env-file /opt/adfilter/.env -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 api
```

---

## 6. Truy cập Dịch vụ từ Máy Cá nhân (SSM Port Forwarding)

Máy chủ EC2 không mở bất kỳ cổng nào ra Internet. Để gửi sự kiện từ Extension hoặc xem bảng điều khiển Grafana, mở terminal chạy lệnh chuyển cổng SSM:

### Chuyển cổng cho Telemetry API (`localhost:3000`):
```bash
# Lấy lệnh tự động từ Terraform output:
terraform -chdir=infra output -raw port_forward_command

# Hoặc chạy trực tiếp:
aws ssm start-session \
  --target <EC2_INSTANCE_ID> \
  --document-name AWS-StartPortForwardingSession \
  --parameters portNumber=3000,localPortNumber=3000 \
  --region ap-southeast-1
```
Kiểm tra ở một terminal khác:
```bash
curl -fsS http://localhost:3000/health
```

### Chuyển cổng cho Grafana (`localhost:3001`):
```bash
aws ssm start-session \
  --target <EC2_INSTANCE_ID> \
  --document-name AWS-StartPortForwardingSession \
  --parameters portNumber=3001,localPortNumber=3001 \
  --region ap-southeast-1
```

---

## 7. Biến Cần Cập nhật khi Dựng lại Máy Chủ (`destroy` -> `apply`)

Mỗi khi thực hiện `terraform destroy` rồi `terraform apply` lại từ đầu, máy chủ EC2 mới sẽ có **Instance ID mới**. Bạn bắt buộc phải cập nhật lại biến `EC2_INSTANCE_ID` trên GitHub để workflow `deploy` gửi lệnh SSM đúng đích:

```bash
gh variable set EC2_INSTANCE_ID --env production --body "$(terraform -chdir=infra output -raw instance_id)"
```

---

## 8. Nhật ký Diễn tập Quay lui (Rollback Drill A: Lỗ hổng & Cách vá)

### Kịch bản diễn tập:
Đưa một cấu hình sai mật khẩu cơ sở dữ liệu vào `docker-compose.prod.yml` (lỗi chỉ kích hoạt ở môi trường production, vượt qua được CI):
```yaml
services:
  api:
    image: ${REGISTRY}/adfilter-api:${IMAGE_TAG}
    environment:
      DATABASE_URL: postgres://adfilter:sai-mat-khau@postgres:5432/adfilter
```

### 1. Dự đoán ban đầu:
Khi container `api` mới không kết nối được Postgres, `/health` sẽ trả về `503`, vòng lặp 20 lần kiểm tra sức khỏe trong `deploy.sh` sẽ thất bại và script sẽ tự động quay về tag ảnh cũ (`$PREV_TAG`), nhờ đó `/health` sẽ trở lại `200 OK`.

### 2. Kết quả thực tế ở Lần thử 1 (với script giải nén đè trực tiếp vào `/opt/adfilter`):
- Workflow `deploy` báo đỏ đúng như dự kiến và in dòng log: `health check that bai, quay ve <TAG_CU>`.
- **NHƯNG `/health` vẫn tiếp tục trả về lỗi `503`!**
- **Nguyên nhân gốc rễ (Lỗ hổng Rollback một nửa):**
  Trước khi `deploy.sh` chạy, lệnh SSM đã giải nén `deploy.tgz` của bản lỗi **đè trực tiếp** lên `/opt/adfilter/docker-compose.prod.yml`. Khi health check thất bại, script chỉ đổi lại biến `IMAGE_TAG="$PREV_TAG"` rồi gọi `docker compose up -d`, nhưng vẫn đọc file `docker-compose.prod.yml` mới (đang chứa dòng `DATABASE_URL` sai mật khẩu). Do đó chỉ có Docker image được quay lui, còn cấu hình thì không!

### 3. Giải pháp khắc phục triệt để (Mô hình Thư mục Phát hành — Release Directories):
Cập nhật `deploy/deploy.sh` và `.github/workflows/deploy.yml`:
1. Mỗi lần triển khai được giải nén vào một thư mục riêng biệt theo mã commit: `/opt/adfilter/releases/<TAG>/`.
2. Dùng tên dự án cố định `docker compose -p adfilter --env-file /opt/adfilter/.env -f "$RELEASE/docker-compose.yml" -f "$RELEASE/docker-compose.prod.yml"` để giữ nguyên container và volume dữ liệu `pgdata` xuyên suốt các bản phát hành.
3. Chỉ khi `/health` trả về `200 OK`, script mới trỏ symlink `/opt/adfilter/current` sang `/opt/adfilter/releases/<TAG>` và dọn các bản cũ (chỉ giữ lại 5 bản phát hành gần nhất).
4. Nếu `/health` thất bại, script đọc đích của symlink `/opt/adfilter/current` (`$PREV`) và gọi `compose "$PREV" up -d --no-build` với `IMAGE_TAG="$PREV_TAG"` — **khôi phục đồng thời cả Docker image lẫn toàn bộ file cấu hình của bản tốt trước đó**.

### 4. Kết quả diễn tập Lần 2 (sau khi vá):
- Khi đẩy lại bản cấu hình lỗi `DATABASE_URL`, workflow `deploy` phát hiện `/health` thất bại sau 60 giây, tự động in:
  `quay ve <TAG_CU> (anh va cau hinh cung quay lui)`
- Kiểm tra ngay lập tức `curl -fsS http://localhost:3000/health` trên máy chủ trả về **`{"ok":true}` (200 OK)**! Hệ thống tự phục hồi hoàn toàn không gián đoạn dịch vụ.
