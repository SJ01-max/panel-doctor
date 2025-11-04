# 자연어 질의 기반 패널 추출 시스템

자연어 질의를 입력받아 패널 데이터를 추출하는 시스템입니다.

## 프로젝트 구조

### Frontend (React + TypeScript + Vite)

```
frontend/
├── src/
│   ├── api/              # API 호출 함수들
│   │   └── panel.ts      # 패널 관련 API
│   ├── components/       # 재사용 가능한 컴포넌트
│   │   ├── base/         # 기본 UI 컴포넌트
│   │   └── layout/       # 레이아웃 컴포넌트
│   ├── features/         # 기능별 모듈 (Feature-based 구조)
│   │   ├── panel/        # 패널 추출 기능
│   │   └── doctor/       # AI 닥터 기능
│   ├── hooks/            # 커스텀 훅
│   ├── lib/              # 라이브러리 및 유틸리티
│   │   └── api/          # API 클라이언트 설정
│   ├── pages/            # 페이지 컴포넌트
│   ├── router/           # 라우팅 설정
│   ├── types/            # TypeScript 타입 정의
│   └── utils/            # 유틸리티 함수
```

**주요 개선사항:**
- `modules` → `features`로 변경 (Feature-based 구조)
- API 관련 파일 통합 (`lib/api/client.ts`)
- Router 구조 단순화

### Backend (Python + Flask)

```
backend/
├── app/
│   ├── __init__.py       # Flask 앱 팩토리
│   ├── config.py         # 설정 관리
│   ├── db/               # 데이터베이스 관련
│   │   ├── __init__.py
│   │   └── connection.py # DB 연결 관리
│   ├── routes/           # API 라우트
│   │   ├── __init__.py
│   │   └── search_routes.py
│   └── services/         # 비즈니스 로직
│       ├── __init__.py
│       ├── query_parser.py   # 자연어 파싱
│       └── panel_service.py  # 패널 검색 서비스
└── main.py               # 애플리케이션 진입점
```

**주요 개선사항:**
- Flask 애플리케이션 팩토리 패턴 적용
- 설정 파일 분리 (`config.py`)
- 서비스 레이어 분리
- Blueprint를 사용한 라우트 구조

## 개발 환경 설정

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

## 환경 변수

### Frontend (.env)

```
VITE_API_BASE_URL=http://localhost:5000
```

### Backend (.env)

```
FLASK_ENV=development
DATABASE_URL=postgresql://user:password@localhost/dbname
SECRET_KEY=your-secret-key
```

## 주요 기능

1. **패널 추출**: 자연어 질의를 입력받아 패널 데이터 추출
2. **AI 닥터**: 개인 맞춤 건강 상담 및 영양제 추천
3. **대시보드**: KPI 및 최근 질의 내역 조회

## 기술 스택

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router

### Backend
- Python 3
- Flask
- PostgreSQL (psycopg2)

## 라이선스

MIT
