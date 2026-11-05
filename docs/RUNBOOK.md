# Sổ tay Xử lý Sự cố Tổng hợp (Master Incident Runbook)

Tài liệu này là điểm tra cứu đầu tiên (**Single Pane of Glass**) khi vận hành AdFilter. Với mọi triệu chứng bất thường ở cả phía **Extension Trình duyệt** lẫn **Hạ tầng Đám mây AWS**, hãy tra bảng dưới đây để thực hiện bước kiểm tra đầu tiên và hành động khắc phục tức thời.

---

## 1. Bảng Phản ứng Sự cố Nhanh (Incident Response Matrix)

| STT | Triệu chứng | Kiểm tra đầu tiên | Hành động khắc phục & Tài liệu chi tiết |
| :-: | :--- | :--- | :--- |
| **1** | **Quảng cáo không được xử lý** (trôi qua bình thường) | Kiểm tra cảnh báo Canary trên Grafana; mở DevTools Console lọc `[AdFilter]` xem tín hiệu `Signals`. | Bấm tắt công tắc `enabled` nếu làm video bất thường; thực hiện quy trình khảo sát khi YouTube đổi giao diện tại [`docs/notes/selectors-survey.md`](notes/selectors-survey.md) và [`docs/notes/canary.md`](notes/canary.md). |
| **2** | **Video bị kẹt, đứng hình hoặc mất tiếng sau quảng cáo** | Nhấn phím tắt khẩn cấp **`Alt + Shift + K`**; kiểm tra thuộc tính `video.muted` và `video.playbackRate` trong Console. | Khôi phục âm lượng bằng tay; bật Recorder ghi lại fixture tái hiện lỗi; kiểm tra sự kiện `PLAYBACK_STUCK` và cơ chế Auto-Resume Guard (xem [`docs/notes/week9-metrics.md`](notes/week9-metrics.md)). |
| **3** | **Xuất hiện hộp thoại cảnh báo chống chặn quảng cáo của trang** | Kiểm tra sự kiện `ENFORCEMENT_SEEN` trong nhật ký hành động (Xuất JSON từ Popup) và trạng thái bộ ngắt mạch (Circuit Breaker). | Bộ ngắt mạch tự động mở khóa an toàn (ngừng can thiệp trong 30 phút), bật `dryRun` nếu cần, **tuyệt đối không cố tình leo thang** (xem [`docs/notes/intervention-design.md`](notes/intervention-design.md)). |
| **4** | **Grafana bắn cảnh báo nhiều lần can thiệp thất bại (`AdFilterVerifyFailBurst`)** | Mở Dashboard Grafana kiểm tra tỉ lệ `VERIFY_FAIL` và đối chiếu báo cáo diễn tập [`docs/notes/chaos-drill-01.md`](notes/chaos-drill-01.md). | Kiểm tra selector nút bỏ qua trong [`src/core/selectors.ts`](../src/core/selectors.ts), cập nhật selector mới, chạy `pnpm verify:all` và phát hành bản vá. |
| **5** | **Grafana bắn cảnh báo bộ ngắt mạch mở hàng loạt (`AdFilterCircuitBreakerTripped`)** | Mở Dashboard Grafana xem tốc độ tăng `CIRCUIT_TRIP` và đối chiếu [`docs/notes/chaos-drill-02.md`](notes/chaos-drill-02.md). | Xác minh xem YouTube có cập nhật cơ chế phát hiện mới không; giữ nguyên trạng thái hạ cấp an toàn (Safe Degradation) cho đến khi kiểm tra xong trên tài khoản thử nghiệm. |
| **6** | **Endpoint `/health` trên AWS không trả về `200 OK` (hoặc `503`)** | Kiểm tra log SSM gần nhất và chạy `docker compose logs api postgres` trong phiên SSM trên EC2. | Thực hiện **Quay lui thủ công trong 1 phút** về mã commit SHA tốt trước đó qua workflow `deploy` (xem hướng dẫn từng bước tại [`docs/notes/deploy-runbook.md`](notes/deploy-runbook.md)). |
| **7** | **Workflow `deploy` trên GitHub Actions báo đỏ** | Mở bước **`In log trien khai khi that bai`** ở cuối job `deploy` trên GitHub Actions. | Hệ thống đã tự động kích hoạt rollback về bản `/opt/adfilter/current` trước đó; đọc log lỗi để sửa cấu hình hoặc chạy `scripts/sync-gh-vars.sh` nếu vừa dựng lại máy EC2 mới (xem [`docs/notes/deploy-runbook.md`](notes/deploy-runbook.md)). |
| **8** | **Chi phí AWS tăng bất thường hoặc nhận email cảnh báo Budget** | Kiểm tra email cảnh báo từ AWS Budgets (`80%` thực tế hoặc `100%` dự báo) và mở **AWS Cost Explorer**. | Nếu chưa cần giữ máy chủ chạy liên tục, lập tức thu hồi toàn bộ tài nguyên tính phí bằng lệnh `terraform -chdir=infra destroy` (xem [`docs/notes/infra-cycle.md`](notes/infra-cycle.md)). |
| **9** | **Nghi ngờ lộ mật khẩu cơ sở dữ liệu hoặc Grafana** | Kiểm tra lịch sử truy cập trong AWS CloudTrail và SSM Parameter Store (`/adfilter/*`). | Thực hiện ngay **Quy trình Xoay Mật khẩu (Secret Rotation)** ở Mục 2 bên dưới. |

---

## 2. Quy trình Xoay Mật khẩu (Secret Rotation Procedure)

Mật khẩu của hệ thống tuyệt đối không nằm trong Git hay Terraform state mà được lưu mã hóa (`SecureString`) trong **AWS SSM Parameter Store**. Khi cần xoay mật khẩu định kỳ hoặc khi nghi ngờ lộ lọt, thực hiện theo đúng các bước sau:

### Bước 1: Cập nhật mật khẩu mới lên SSM Parameter Store
*(Lưu ý: Chỉ sử dụng chữ cái và chữ số dài tối thiểu 24 ký tự để tránh ký tự `$` bị Docker Compose nội suy biến)*:
```bash
# 1. Xoay mật khẩu Grafana
aws ssm put-parameter \
  --name /adfilter/grafana_password \
  --type SecureString \
  --overwrite \
  --value '<MAT_KHAU_GRAFANA_MOI_24_KY_TU>' \
  --region ap-southeast-1

# 2. Xoay mật khẩu PostgreSQL (nếu cần)
aws ssm put-parameter \
  --name /adfilter/postgres_password \
  --type SecureString \
  --overwrite \
  --value '<MAT_KHAU_POSTGRES_MOI_24_KY_TU>' \
  --region ap-southeast-1
```

### Bước 2: Kích hoạt triển khai lại để cập nhật file `/opt/adfilter/.env`
```bash
gh workflow run deploy.yml
gh run watch
```
Khi `deploy/deploy.sh` chạy, script sẽ tự động kéo giá trị mới từ SSM Parameter Store và ghi đè vào `/opt/adfilter/.env` (với `umask 077` chỉ chủ sở hữu mới đọc được).

### Bước 3: Lưu ý thực tế với Volume dữ liệu đã khởi tạo (Grafana & PostgreSQL)
Trong thực tế vận hành Docker:
- Biến môi trường `GF_SECURITY_ADMIN_PASSWORD` (Grafana) và `POSTGRES_PASSWORD` (PostgreSQL) **chỉ được đọc tự động trong lần khởi tạo volume dữ liệu đầu tiên**.
- Khi volume đã có sẵn dữ liệu từ trước, sau khi cập nhật `/opt/adfilter/.env`, bạn cần kết nối vào máy chủ qua SSM (`aws ssm start-session --target <INSTANCE_ID>`) và chạy lệnh cập nhật trực tiếp bên trong container:

```bash
# Đối với Grafana: Đặt lại mật khẩu admin trong database nội bộ của Grafana
sudo docker exec -it adfilter-grafana-1 grafana cli admin reset-admin-password '<MAT_KHAU_GRAFANA_MOI_24_KY_TU>'

# Đối với PostgreSQL: Cập nhật mật khẩu của role adfilter khớp với file .env mới
sudo docker exec -it adfilter-postgres-1 psql -U adfilter -d adfilter -c "ALTER USER adfilter WITH PASSWORD '<MAT_KHAU_POSTGRES_MOI_24_KY_TU>';"
```

### Bước 4: Kiểm tra xác nhận
Mở cổng chuyển SSM Port Forwarding (`portNumber=3001,localPortNumber=3001`), đăng nhập vào `http://localhost:3001` bằng mật khẩu mới và kiểm tra `curl -fsS http://localhost:3000/health` trả về `{"ok":true}`.
