# Nhật ký kiểm chứng chu kỳ Hạ tầng & Trôi cấu hình (Infra Cycle & Drift Report)

## 1. Đo lường chu kỳ Dựng và Hủy hạ tầng (Apply - Destroy Cycle)
Toàn bộ hạ tầng đám mây của AdFilter được định nghĩa bằng Terraform khai báo (Declarative IaC), cho phép tái hiện một hệ thống độc lập hoàn toàn chỉ trong vài phút.

| Thao tác | Thời gian thực thi | Kết quả kiểm chứng | Trạng thái tài nguyên AWS |
| :--- | :--- | :--- | :--- |
| `terraform destroy` | ~ 1 phút 15 giây | Xóa thành công 8 tài nguyên | EC2 chuyển sang `terminated`, ECR repo xóa sạch, Security Group & IAM roles bị thu hồi. |
| `terraform apply` | ~ 2 phút 30 giây | Khởi tạo lại 8 tài nguyên từ đầu | EC2 mới sẵn sàng, Docker daemon khởi động qua `user_data.sh`, kết nối SSM bình thường. |

---

## 2. Thí nghiệm trôi cấu hình (Configuration Drift Experiment)

### Kịch bản thử nghiệm:
1. **Tạo biến dạng thủ công (ClickOps):** Trên AWS Console, mở Security Group `adfilter-app` và thêm thủ công quy tắc Inbound cho phép mở cổng SSH (`port 22`) từ IP `0.0.0.0/0`.
2. **Kiểm tra phát hiện trôi cấu hình:** Chạy lệnh kiểm tra từ terminal:
   ```bash
   terraform -chdir=infra plan
   ```
3. **Kết quả quan sát:**
   Terraform so sánh trạng thái thực tế (Real-world State) với file cấu hình code (`infra/network.tf`) và phát hiện chính xác quy tắc cổng 22 là phần tử trôi cấu hình ngoài ý muốn:
   ```text
   ~ resource "aws_security_group" "app" {
       - ingress { ... port 22 ... } # will be deleted
     }
   Plan: 0 to add, 1 to change, 0 to destroy.
   ```
4. **Tự động phục hồi trạng thái chuẩn:** Chạy `terraform -chdir=infra apply -auto-approve`. Quy tắc mở cổng 22 lập tức bị thu hồi, khôi phục lại kiến trúc bảo mật không mở cổng ngoài.

### Bài học rút ra (Tại sao không bao giờ sửa tay trên AWS Console?):
- **Gây mất tính nhất quán:** Sửa tay trên giao diện khiến file code Terraform không còn là nguồn chân lý duy nhất (Single Source of Truth).
- **Nguy cơ bảo mật nghiêm trọng:** Mở cổng tạm thời để debug rồi quên đóng có thể dẫn đến việc server bị quét và tấn công tự động (brute-force bot).
- **Mất kiểm soát phiên bản (No Audit Trail):** Các thao tác sửa trên Console không được lưu qua Git commit, khiến team không thể tra cứu ai đã sửa, sửa lúc nào và vì lý do gì.

---

## 3. Các tài nguyên sống ngoài vòng đời của Terraform Stack
Khi thực hiện `terraform destroy`, các tài nguyên sau **vẫn được bảo toàn nguyên vẹn** (không bị xóa) vì chúng nằm ngoài stack chính:
1. **S3 Bucket lưu State (`adfilter-tfstate-<ACCOUNT_ID>`):** Được tạo ở bước `bootstrap/main.tf` độc lập để bảo vệ lịch sử state vĩnh viễn.
2. **Bí mật trong SSM Parameter Store (`/adfilter/*`):**
   - `/adfilter/postgres_password`
   - `/adfilter/grafana_password`
   *(Được khởi tạo trực tiếp qua AWS CLI, không lưu trong file state)*.

### Hướng dẫn dọn dẹp sạch hoàn toàn khi muốn đóng dự án:
```bash
# 1. Hủy stack hạ tầng chính
terraform -chdir=infra destroy -auto-approve

# 2. Xóa các bí mật trong SSM Parameter Store
aws ssm delete-parameters --names /adfilter/postgres_password /adfilter/grafana_password --region ap-southeast-1

# 3. Xóa bucket state trong bootstrap
terraform -chdir=infra/bootstrap destroy -auto-approve
```

---

## 4. Báo cáo kiểm soát chi phí thực tế (Cost Explorer)
- **Mức ngân sách đăng ký:** $10.00 USD / tháng.
- **Chi phí phát sinh thực tế:** $0.00 – $0.05 USD trong suốt quá trình chạy bài kiểm tra vòng đời (nhờ sử dụng EC2 `t3.small` và hủy tài nguyên ngay sau khi kiểm chứng).
- **Hệ thống cảnh báo:** AWS Budget hoạt động ổn định và sẵn sàng kích hoạt email nếu chi phí vượt ngưỡng 80% ($8.00 USD).
