#!/bin/bash
set -e
echo "[AfterInstall] 📦 Installing Python dependencies..."

cd /home/ec2-user/app/backend

# pip 최신화
pip3 install --upgrade pip setuptools wheel

# ✅ 가상환경 사용 여부 확인 (선택사항)
# 가상환경을 사용하려면 아래 주석 해제
# if [ ! -d "venv" ]; then
#   echo "[AfterInstall] Creating virtual environment..."
#   python3 -m venv venv
# fi
# source venv/bin/activate

# 패키지 설치 (의존성 확인 강화)
echo "[AfterInstall] Installing packages from requirements.txt..."
pip3 install --no-cache-dir -r requirements.txt

# ✅ 설치 확인
echo "[AfterInstall] Verifying critical packages..."
python3 -c "import anthropic; print(f'✅ anthropic: {anthropic.__version__}')" || echo "⚠️ anthropic 설치 실패"
python3 -c "import sentence_transformers; print('✅ sentence-transformers 설치됨')" || echo "⚠️ sentence-transformers 설치 실패"
python3 -c "import tensorflow; print(f'✅ tensorflow: {tensorflow.__version__}')" || echo "⚠️ tensorflow 설치 실패"
python3 -c "import gunicorn; print('✅ gunicorn 설치됨')" || echo "⚠️ gunicorn 설치 실패"

echo "[AfterInstall] ✅ Python dependencies installed."
