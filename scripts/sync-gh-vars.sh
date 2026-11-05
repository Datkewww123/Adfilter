#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
out() { terraform -chdir=infra output -raw "$1"; }

gh variable set EC2_INSTANCE_ID --env production --body "$(out instance_id)"
gh variable set ARTIFACT_BUCKET --env production --body "$(out artifact_bucket)"
gh variable set AWS_DEPLOY_ROLE_ARN --env production --body "$(out deploy_role_arn)"
gh variable set AWS_PLAN_ROLE_ARN --body "$(out plan_role_arn)"

echo "Da dong bo bien GitHub thanh cong"
