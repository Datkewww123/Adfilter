#!/bin/bash
set -euo pipefail

TAG="$1"
BASE=/opt/adfilter
RELEASE="$BASE/releases/$TAG"
REGION=ap-southeast-1
PREV="$(readlink "$BASE/current" 2>/dev/null || true)"

compose() {
  docker compose -p adfilter --env-file "$BASE/.env" \
    -f "$1/docker-compose.yml" -f "$1/docker-compose.prod.yml" "${@:2}"
}

umask 077
PG="$(aws ssm get-parameter --name /adfilter/postgres_password --with-decryption --query Parameter.Value --output text --region "$REGION")"
GF="$(aws ssm get-parameter --name /adfilter/grafana_password --with-decryption --query Parameter.Value --output text --region "$REGION")"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
printf 'POSTGRES_PASSWORD=%s\nGRAFANA_PASSWORD=%s\nREGISTRY=%s\n' "$PG" "$GF" "$REGISTRY" > "$BASE/.env"

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

export IMAGE_TAG="$TAG"
compose "$RELEASE" pull api
compose "$RELEASE" up -d --no-build

for i in $(seq 1 20); do
  if curl -fsS http://localhost:3000/health > /dev/null; then
    ln -sfn "$RELEASE" "$BASE/current"
    ls -1dt "$BASE"/releases/* | tail -n +6 | xargs -r rm -rf
    echo "deploy ok: $TAG"
    exit 0
  fi
  sleep 3
done

echo "health check that bai"
if [ -n "$PREV" ] && [ -d "$PREV" ]; then
  PREV_TAG="$(basename "$PREV")"
  echo "quay ve $PREV_TAG (anh va cau hinh cung quay lui)"
  export IMAGE_TAG="$PREV_TAG"
  compose "$PREV" up -d --no-build
fi
exit 1
