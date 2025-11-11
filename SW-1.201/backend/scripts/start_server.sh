#!/bin/bash
echo "[ApplicationStart] 🚀 Starting Gunicorn server..."

cd /home/ec2-user/app/backend

# ✅ 이전에 실행 중인 프로세스 종료 (Flask or Gunicorn)
pkill -f "gunicorn" || true
pkill -f "python3 main.py" || true

# ✅ 로그 디렉터리 확인
if [ ! -d "/home/ec2-user/app/backend/logs" ]; then
  mkdir -p /home/ec2-user/app/backend/logs
fi

# ✅ Gunicorn 실행 (main.py 내부의 app 객체)
nohup gunicorn --workers 3 --bind 0.0.0.0:5000 main:app > /home/ec2-user/app/backend/logs/server.log 2>&1 &

echo "[ApplicationStart] ✅ Gunicorn server started on port 5000."
