variable "region" {
  type        = string
  description = "AWS region"
  default     = "ap-southeast-1"
}

variable "name" {
  type        = string
  description = "Application name prefix"
  default     = "adfilter"
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type"
  default     = "t3.small"
}

variable "alert_email" {
  type        = string
  description = "Email address for AWS Budget alerts"
  default     = "alerts@example.com"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository in OWNER/REPO format (dung cho OIDC o tuan 19)"
  default     = ""
}
