# Panel Doctor

자연어 기반 패널 검색 및 AI 닥터 추천 시스템

## 프로젝트 구조

```
panel-doctor/
├── panel1.0/
│   ├── backend/      # Flask 백엔드 서버
│   └── frontend/      # React + Vite 프론트엔드
```

## 사전 요구사항

- **Python 3.8+** (백엔드)
- **Node.js 18+** (프론트엔드)
- **PostgreSQL** (AWS RDS 사용 중)

## 빠른 시작 (Quick Start)

```bash
# 1. 저장소 클론
git clone <repository-url>
cd panel-doctor

# 2. 백엔드 설정
cd panel1.0/backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows PowerShell
pip install -r requirements.txt
# .env 파일 생성 (아래 환경 변수 설정 참고)
python main.py

# 3. 프론트엔드 설정 (새 터미널)
cd panel1.0/frontend
npm install
# .env 파일 생성 (VITE_API_BASE_URL=http://localhost:5000)
npm run dev
```

## 환경 변수 설정

### 백엔드 (.env) - 필수!

`panel1.0/backend/` 폴더에 `.env` 파일을 생성하세요.

**⚠️ 중요: LLM 기능을 사용하려면 `ANTHROPIC_API_KEY`가 반드시 필요합니다!**

```env
# Flask 환경 설정
FLASK_ENV=development
DEBUG=true

# 데이터베이스 연결 (DATABASE_URL 우선 사용)
# URL 인코딩된 비밀번호 사용 가능
DATABASE_URL=postgresql://user:password@host:5432/database

# 또는 개별 설정 사용
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-password

# ⚠️ LLM 연동 필수! (팀 리더에게 문의)
ANTHROPIC_API_KEY=your-anthropic-api-key

# 보안
SECRET_KEY=your-secret-key

# CORS 설정 (프론트엔드 주소를 쉼표로 구분)
# 여러 포트를 사용하는 경우 모두 추가
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173

# 서버 포트 (선택사항, 기본값: 5000)
PORT=5000
```

**주의사항:**
- 실제 DB 정보와 API 키는 팀 리더에게 문의하세요
- `.env` 파일은 Git에 커밋되지 않습니다 (`.gitignore`에 포함됨)
- **`ANTHROPIC_API_KEY`가 없으면 LLM 기능이 작동하지 않습니다!**

### 프론트엔드 (.env)

`panel1.0/frontend/` 폴더에 `.env` 파일을 생성하세요.

```env
# 백엔드 API 주소
# 로컬 개발 시: http://localhost:5000
VITE_API_BASE_URL=http://localhost:5000
```

## 설치 및 실행 방법

### 1. 저장소 클론

```bash
git clone <repository-url>
cd panel-doctor
```

### 2. 백엔드 설정

```bash
cd panel1.0/backend

# 가상환경 생성 (최초 1회만)
python -m venv venv

# 가상환경 활성화
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Windows CMD:
venv\Scripts\activate.bat
# macOS/Linux:
source venv/bin/activate

# 의존성 설치 (최초 1회만)
pip install -r requirements.txt

# 환경 변수 설정
# .env 파일을 생성하고 위의 "환경 변수 설정" 섹션 참고
# 특히 ANTHROPIC_API_KEY는 필수!

# 서버 실행
python main.py
```

백엔드 서버는 **http://localhost:5000** 에서 실행됩니다.

### 3. 프론트엔드 설정

```bash
cd panel1.0/frontend

# 의존성 설치 (최초 1회만)
npm install

# 환경 변수 설정
# .env 파일을 생성하고 VITE_API_BASE_URL=http://localhost:5000 설정

# 개발 서버 실행
npm run dev
```

프론트엔드 서버는 **http://localhost:3000** 에서 실행됩니다.

## LLM 연동 확인

LLM 기능이 제대로 작동하는지 확인하려면:

1. 백엔드 서버가 실행 중인지 확인
2. 브라우저에서 프론트엔드 접속
3. LLM 기능 사용 시도
4. 에러가 발생하면:
   - 백엔드 터미널에서 에러 메시지 확인
   - `ANTHROPIC_API_KEY`가 `.env`에 올바르게 설정되었는지 확인
   - API 키가 유효한지 확인

## 포트 변경

### 프론트엔드 포트 변경

프론트엔드 포트를 변경하려면:

1. `panel1.0/frontend/vite.config.js`에서 `server.port` 수정
2. `panel1.0/backend/.env`의 `CORS_ORIGINS`에 새 포트 추가

예: 3001 포트 사용 시
```javascript
// vite.config.js
server: {
  port: 3001,
  // ...
}
```

```env
# backend/.env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173,...
```

### 백엔드 포트 변경

```bash
# 환경 변수로 설정
export PORT=5001  # macOS/Linux
set PORT=5001     # Windows CMD
$env:PORT=5001    # Windows PowerShell

# 또는 .env 파일에 추가
PORT=5001
```

## 문제 해결

### DB 연결 실패

1. `.env` 파일의 DB 정보 확인
2. AWS RDS 보안 그룹에서 현재 IP 허용 확인
3. `python check_db_status.py` 실행하여 연결 테스트

### CORS 에러

1. 백엔드 `.env`의 `CORS_ORIGINS`에 프론트엔드 주소가 포함되어 있는지 확인
2. 백엔드 서버 재시작

### LLM 기능이 작동하지 않음

1. **가장 중요**: `.env` 파일에 `ANTHROPIC_API_KEY`가 설정되어 있는지 확인
2. API 키가 유효한지 확인
3. 백엔드 서버 재시작 (환경 변수 변경 후)
4. 백엔드 터미널에서 에러 메시지 확인:
   - `ANTHROPIC_API_KEY 환경변수가 필요합니다.` → API 키가 없음
   - `401 Unauthorized` → API 키가 잘못됨

### 포트 충돌

다른 포트를 사용하거나 실행 중인 프로세스 종료:
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

## 개발 가이드

### 백엔드 API

- API 기본 경로: `/api`
- 주요 엔드포인트:
  - `GET /api/panel/dashboard` - 대시보드 데이터
  - `POST /api/panel/search` - 패널 검색
  - `POST /api/llm/sql_search` - SQL 쿼리 생성 (LLM 사용)
  - `POST /api/llm/ask` - LLM 질의응답
  - `GET /api/llm/models` - 사용 가능한 모델 목록

### 프론트엔드

- React 19 + TypeScript
- Vite 빌드 도구
- Tailwind CSS 스타일링

## 라이선스

[라이선스 정보]

