#!/bin/bash
echo "[AfterInstall] 📦 Installing Python dependencies..."

cd /home/ec2-user/app/backend

# pip 최신화 및 패키지 설치
pip3 install --upgrade pip
pip3 install -r requirements.txt

echo "[AfterInstall] ✅ Python dependencies installed."
