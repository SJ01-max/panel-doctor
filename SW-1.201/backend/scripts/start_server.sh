#!/bin/bash
echo "[ApplicationStart] 🚀 Starting Flask server..."

# 기존 프로세스 종료 (있을 경우)
pkill -f "python3 main.py" || true

cd /home/ec2-user/app/backend

# Flask 서버 백그라운드 실행
nohup python3 main.py > server.log 2>&1 &

echo "[ApplicationStart] ✅ Flask server started on port 5000."
