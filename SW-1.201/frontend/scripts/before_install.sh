#!/bin/bash
set -e
echo "[BeforeInstall] 🔍 Checking Node.js environment..."

# ✅ nvm 환경 로드 강제
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# ✅ Node 20 사용 시도 (이미 설치된 경우)
if command -v node &> /dev/null; then
  echo "[BeforeInstall] Node currently: $(node -v)"
  nvm use 20 || echo "[BeforeInstall] Node 20 not yet installed, proceeding to install..."
else
  echo "[BeforeInstall] Node not found, installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  source ~/.bashrc
fi

# ✅ Node 20 설치 및 기본 버전 지정
if ! nvm ls 20 &> /dev/null; then
  echo "[BeforeInstall] Installing Node 20..."
  nvm install 20
fi
nvm alias default 20
nvm use 20

echo "[BeforeInstall] ✅ Node version: $(node -v)"
echo "[BeforeInstall] ✅ NPM version: $(npm -v)"
