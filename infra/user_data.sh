#!/bin/bash
set -euo pipefail

# Cap nhat he thong va cai dat Docker tren Amazon Linux 2023
dnf install -y docker
systemctl enable --now docker
usermod -aG docker ec2-user

# Cai dat Docker Compose v2 plugin
mkdir -p /usr/local/lib/docker/cli-plugins /opt/adfilter
curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Phan quyen thu muc trien khai ung dung
chown -R ec2-user:ec2-user /opt/adfilter
