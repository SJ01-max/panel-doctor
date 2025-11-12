#!/bin/bash
echo "[AfterInstall] 🔧 Fixing frontend ownership and permissions..."

# 프론트 전체 소유권 복구
sudo chown -R ec2-user:ec2-user /home/ec2-user/app

# 실행 스크립트들 실행권한 부여
sudo chmod +x /home/ec2-user/app/frontend/scripts/*.sh

# node_modules가 있다면 권한도 복구
if [ -d "/home/ec2-user/app/node_modules" ]; then
  sudo chown -R ec2-user:ec2-user /home/ec2-user/app/node_modules
fi

echo "[AfterInstall] ✅ Frontend ownership & permissions fixed successfully."
