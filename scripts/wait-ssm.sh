#!/bin/bash
set -euo pipefail

ID="$(terraform -chdir=infra output -raw instance_id)"
for i in $(seq 1 60); do
  STATUS="$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$ID" --query 'InstanceInformationList[0].PingStatus' --output text --region ap-southeast-1 2>/dev/null || true)"
  if [ "$STATUS" = "Online" ]; then
    echo "May $ID da online trong SSM"
    exit 0
  fi
  sleep 10
done

echo "Het gio cho SSM" >&2
exit 1
