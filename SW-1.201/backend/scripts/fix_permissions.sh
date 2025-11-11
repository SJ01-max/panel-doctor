#!/bin/bash
echo "[AfterInstall] 🔧 Fixing ownership and permissions..."

# 백엔드 및 상위 경로 소유권 복구
sudo chown -R ec2-user:ec2-user /home/ec2-user/app
sudo chmod -R 755 /home/ec2-user/app/backend
sudo chmod +x /home/ec2-user/app/backend/scripts/*.sh

echo "[AfterInstall] ✅ Ownership & permissions fixed successfully."
