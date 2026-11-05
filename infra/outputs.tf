output "instance_id" {
  description = "ID cua EC2 instance chay server AdFilter"
  value       = aws_instance.app.id
}

output "ecr_repository_url" {
  description = "URL cua ECR repository de push Docker image"
  value       = aws_ecr_repository.api.repository_url
}

output "port_forward_command" {
  description = "Lenh SSM Port Forwarding de truy cap API tu may local qua port 3000"
  value       = "aws ssm start-session --target ${aws_instance.app.id} --document-name AWS-StartPortForwardingSession --parameters portNumber=3000,localPortNumber=3000"
}

output "deploy_role_arn" {
  description = "ARN cua IAM role dung cho GitHub Actions deploy"
  value       = aws_iam_role.deploy.arn
}

output "plan_role_arn" {
  description = "ARN cua IAM role chi doc dung cho GitHub Actions terraform plan"
  value       = aws_iam_role.plan.arn
}

output "artifact_bucket" {
  description = "Ten S3 bucket chua goi trien khai (deploy bundles)"
  value       = aws_s3_bucket.artifacts.bucket
}
