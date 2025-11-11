#!/bin/bash
set -e
echo "[AfterInstall] 📦 Installing frontend dependencies..."

cd /home/ec2-user/app

sudo chown -R ec2-user:ec2-user /home/ec2-user/app
sudo chmod -R 755 /home/ec2-user/app

sudo rm -rf /home/ec2-user/app/node_modules

# ✅ nvm 환경 로드 (CodeDeploy 환경용)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20

if ! grep -q '"http-proxy-middleware"' package.json; then
  echo "[AfterInstall] ⚙️ http-proxy-middleware not found in package.json. Installing it..."
  npm install http-proxy-middleware --save
else
  echo "[AfterInstall] ✅ http-proxy-middleware already defined in package.json."
fi

if [ -f "package.json" ]; then
  echo "[AfterInstall] Running npm install..."
  npm install express
  npm install --omit=dev
  echo "[AfterInstall] ✅ npm install complete."
else
  echo "[AfterInstall] ⚠️ package.json not found in $(pwd). Skipping npm install."
fi
