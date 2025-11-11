#!/bin/bash
set -e
echo "[ApplicationStart] 🚀 Starting Express server for built frontend..."

cd /home/ec2-user/app

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20

# ✅ 권한 보정
sudo chown -R ec2-user:ec2-user /home/ec2-user

# 기존 vite나 node 프로세스 종료
VITE_PID=$(pgrep -f "vite" || true)
NODE_PID=$(pgrep -f "node server.js" || true)

if [ -n "$VITE_PID" ]; then
  echo "[ApplicationStart] Killing old vite process (PID: $VITE_PID)..."
  kill -9 $VITE_PID || true
fi

if [ -n "$NODE_PID" ]; then
  echo "[ApplicationStart] Killing old node process (PID: $NODE_PID)..."
  kill -9 $NODE_PID || true
fi

# ✅ 절대경로 기반 Node 실행
NODE_BIN=$(which node)
nohup $NODE_BIN server.js > /home/ec2-user/frontend.log 2>&1 &

echo "[ApplicationStart] ✅ Express server started on port 3000."
