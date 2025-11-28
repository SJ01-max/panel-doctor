#!/bin/bash
set -e
echo "[ApplicationStart] 🚀 Starting Flask server..."

# 기존 프로세스 종료 (있을 경우)
pkill -f "python3 main.py" || true
pkill -f "gunicorn" || true

cd /home/ec2-user/app/backend

# ✅ 환경 변수 설정 (AWS Secrets Manager 사용 시 자동으로 로드됨)
# 필요한 경우 여기에 추가 환경 변수 설정 가능
# export DATABASE_URL="..."
# export ANTHROPIC_API_KEY="..."

# ✅ AWS Secrets Manager에서 환경 변수 로드 (config.py에서 자동 처리)
# SECRET_NAME은 환경 변수 또는 기본값 사용: /panel-doctor/panel1.0/backend
export AWS_SECRET_NAME="${AWS_SECRET_NAME:-/panel-doctor/panel1.0/backend}"
export AWS_REGION="${AWS_REGION:-ap-northeast-2}"

# ✅ 프로덕션 환경에서는 gunicorn 사용, 개발 환경에서는 python3 main.py 사용
USE_GUNICORN="${USE_GUNICORN:-true}"
PORT="${PORT:-5000}"
WORKERS="${WORKERS:-4}"

if [ "$USE_GUNICORN" = "true" ] && command -v gunicorn &> /dev/null; then
    echo "[ApplicationStart] 🚀 Starting with Gunicorn (production mode)..."
    # gunicorn으로 실행 (프로덕션)
    nohup gunicorn \
        --bind 0.0.0.0:${PORT} \
        --workers ${WORKERS} \
        --timeout 120 \
        --access-logfile /home/ec2-user/app/backend/access.log \
        --error-logfile /home/ec2-user/app/backend/error.log \
        --log-level info \
        --preload \
        main:app > /home/ec2-user/app/backend/server.log 2>&1 &
    echo "[ApplicationStart] ✅ Gunicorn server started on port ${PORT} with ${WORKERS} workers."
else
    echo "[ApplicationStart] 🚀 Starting with Flask development server..."
    # Flask 개발 서버로 실행 (fallback)
    nohup python3 main.py > /home/ec2-user/app/backend/server.log 2>&1 &
    echo "[ApplicationStart] ✅ Flask development server started on port ${PORT}."
fi

echo "[ApplicationStart] 📝 Log file: /home/ec2-user/app/backend/server.log"
echo "[ApplicationStart] 📝 Error log: /home/ec2-user/app/backend/error.log"
