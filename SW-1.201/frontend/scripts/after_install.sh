#!/bin/bash
set -e
echo "[AfterInstall] 📦 Installing frontend dependencies..."

cd /home/ec2-user/app

# ✅ nvm 환경 로드 (CodeDeploy 환경용)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20

if [ -f "package.json" ]; then
  echo "[AfterInstall] Running npm install..."
  npm install --omit=dev
  echo "[AfterInstall] ✅ npm install complete."
else
  echo "[AfterInstall] ⚠️ package.json not found in $(pwd). Skipping npm install."
fi
