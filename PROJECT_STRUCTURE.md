# Panel Doctor 프로젝트 구조 가이드

> 팀원들을 위한 프로젝트 구조 설명서

## 📁 전체 프로젝트 트리 구조

```
panel-doctor/                          # 프로젝트 루트
│
├── 📄 .gitignore                      # Git 무시 파일 (루트)
├── 📄 buildspec.yml                   # AWS CodeBuild 설정
├── 📄 PROJECT_LOGIC.md                # 프로젝트 로직 문서
├── 📄 PROJECT_STRUCTURE.md            # 이 문서 (프로젝트 구조 설명)
├── 📄 README.md                       # 프로젝트 README
│
└── 📁 panel1.0/                       # 메인 애플리케이션 디렉토리
    │
    ├── 📁 backend/                    # Flask 백엔드 서버
    │   │
    │   ├── 📄 main.py                 # Flask 앱 진입점 (서버 시작)
    │   ├── 📄 requirements.txt        # Python 의존성 목록
    │   ├── 📄 appspec.yml            # AWS CodeDeploy 설정 (백엔드)
    │   ├── 📄 buildspec.yml          # 백엔드 빌드 설정
    │   ├── 📄 REFACTORING_SUMMARY.md # 리팩토링 요약 문서
    │   │
    │   ├── 📁 app/                    # Flask 애플리케이션 핵심 코드
    │   │   │
    │   │   ├── 📄 __init__.py         # Flask 앱 팩토리 (create_app 함수)
    │   │   ├── 📄 config.py           # 앱 설정 (DB, LLM, CORS 등)
    │   │   ├── 📄 secret_loader.py    # 환경변수/시크릿 로더
    │   │   │
    │   │   ├── 📁 db/                 # 데이터베이스 계층
    │   │   │   ├── __init__.py
    │   │   │   └── connection.py      # PostgreSQL 연결 관리 (Connection Pool)
    │   │   │
    │   │   ├── 📁 routes/             # API 라우트 (엔드포인트 정의)
    │   │   │   ├── __init__.py
    │   │   │   ├── search.py          # 통합 검색 API (/api/search)
    │   │   │   │                       # → SearchService 사용, 자연어 질의 처리
    │   │   │   ├── search_routes.py   # 패널 대시보드/도구 API
    │   │   │   │                       # → /api/panel/dashboard, /api/tools/*
    │   │   │   ├── llm_routes.py      # LLM API (/api/llm/*)
    │   │   │   │                       # → SQL 생성, 페르소나 생성 등
    │   │   │   ├── target_group_routes.py  # 타겟 그룹 API (/api/target-groups/*)
    │   │   │   ├── data_source_routes.py    # 데이터 소스 API (/api/data-sources/*)
    │   │   │   └── export_routes.py         # 내보내기 API (/api/exports/*)
    │   │   │
    │   │   ├── 📁 services/           # 비즈니스 로직 계층
    │   │   │   │
    │   │   │   ├── 📁 common/         # 공통 유틸리티
    │   │   │   │   └── singleton.py   # 싱글톤 패턴 구현
    │   │   │   │
    │   │   │   ├── 📁 search/         # 검색 서비스 (전략 패턴)
    │   │   │   │   ├── service.py     # 통합 검색 서비스 (메인)
    │   │   │   │   │                   # → 전략 선택, Fallback 처리
    │   │   │   │   └── 📁 strategy/   # 검색 전략 구현체들
    │   │   │   │       ├── base.py           # 전략 인터페이스
    │   │   │   │       ├── selector.py        # 전략 선택기 (LLM 기반)
    │   │   │   │       ├── filter_first.py    # 필터 우선 검색 (SQL 기반)
    │   │   │   │       ├── semantic_first.py # 의미 검색 우선 (벡터 기반)
    │   │   │   │       └── hybrid.py         # 하이브리드 검색 (SQL + 벡터)
    │   │   │   │
    │   │   │   ├── 📁 llm/            # LLM 서비스
    │   │   │   │   ├── client.py      # Claude API 클라이언트 (Anthropic)
    │   │   │   │   ├── parser.py      # LLM 응답 파서 (JSON 파싱)
    │   │   │   │   └── prompts.py    # 프롬프트 템플릿 관리
    │   │   │   │
    │   │   │   └── 📁 data/           # 데이터 접근 계층 (DAO)
    │   │   │       ├── executor.py   # SQL 실행기 (안전한 쿼리 실행)
    │   │   │       ├── sql_builder.py # 동적 SQL 빌더 (필터 쿼리 생성)
    │   │   │       ├── vector.py      # 벡터 검색 서비스 (pgvector)
    │   │   │       ├── panel.py       # 패널 데이터 접근
    │   │   │       ├── target_group.py # 타겟 그룹 데이터 접근
    │   │   │       └── export_history.py # 내보내기 이력 관리
    │   │   │
    │   │   └── 📁 utils/              # 유틸리티 함수
    │   │       ├── calculate_panel_count.py  # 패널 수 계산
    │   │       ├── generate_summary.py       # 타겟 그룹 요약 생성
    │   │       ├── file_generator.py         # 파일 생성 (CSV, Excel, PDF)
    │   │       ├── panel_schema.py           # 패널 스키마 관리
    │   │       └── check_interests_data.py   # interests 데이터 확인
    │   │
    │   ├── 📁 scripts/                # 배포/ETL 스크립트
    │   │   ├── start_server.sh         # 서버 시작 스크립트
    │   │   ├── stop_server.sh          # 서버 중지 스크립트
    │   │   ├── install_dependencies.sh # 의존성 설치 스크립트
    │   │   ├── fix_permissions.sh      # 권한 설정 스크립트
    │   │   ├── clean_old_files.sh      # 배포 전 정리 스크립트
    │   │   ├── etl_load_all.py         # 통합 ETL 파이프라인
    │   │   ├── build_all_meta_and_reload_response.py  # 메타데이터 생성 + 응답 재적재
    │   │   └── embed_panel_json.py     # 임베딩 생성 (벡터 검색용)
    │   │
    │   ├── 📁 tests/                   # 단위 테스트
    │   │   ├── test_llm_structured_parser.py
    │   │   ├── test_search_integration.py
    │   │   └── test_strategy_selector.py
    │   │
    │   ├── 📁 model_cache/             # 임베딩 모델 캐시 (Git LFS)
    │   │   └── models--BAAI--bge-m3/   # BGE-M3 모델 캐시
    │   │       ├── blobs/              # 모델 파일들 (대용량)
    │   │       ├── refs/               # Git LFS 참조
    │   │       └── snapshots/          # 모델 스냅샷
    │   │
    │   ├── 📁 exports/                 # 생성된 내보내기 파일 (Git 무시)
    │   │   └── *.xlsx, *.csv, *.pdf   # 사용자가 내보낸 파일들
    │   │
    │   └── 📁 venv/                    # Python 가상환경 (로컬 개발용, Git 무시)
    │
    └── 📁 frontend/                    # React + TypeScript 프론트엔드
        │
        ├── 📄 index.html               # HTML 진입점
        ├── 📄 package.json             # 프론트엔드 의존성
        ├── 📄 vite.config.js           # Vite 빌드 설정
        ├── 📄 tailwind.config.cjs      # Tailwind CSS 설정
        ├── 📄 tsconfig.json            # TypeScript 설정
        ├── 📄 appspec.yml              # AWS CodeDeploy 설정 (프론트엔드)
        ├── 📄 server.js                # 프로덕션 서버 (Express)
        ├── 📄 auto-imports.d.ts        # 자동 import 타입 (자동 생성)
        │
        ├── 📁 scripts/                 # 프론트엔드 배포 스크립트
        │   ├── before_install.sh
        │   ├── after_install.sh
        │   ├── fix_permissions.sh
        │   ├── start_all.sh
        │   └── stop_all.sh
        │
        ├── 📁 out/                     # 빌드 출력 디렉토리 (Git 무시)
        │   ├── index.html
        │   └── assets/                 # 번들된 JS/CSS
        │       ├── index-*.css
        │       ├── index-*.js
        │       └── index-*.js.map
        │
        └── 📁 src/                     # 소스 코드
            │
            ├── 📄 main.tsx             # React 진입점
            ├── 📄 App.tsx              # 루트 컴포넌트
            ├── 📄 index.css            # 글로벌 스타일
            │
            ├── 📁 api/                 # API 클라이언트 (백엔드 통신)
            │   ├── client.ts           # Axios 인스턴스 (기본 설정)
            │   ├── search.ts           # 검색 API (/api/search)
            │   ├── llm.ts              # LLM API (/api/llm/*)
            │   ├── panel.ts            # 패널 API (/api/panel/*)
            │   ├── target-group.ts     # 타겟 그룹 API (/api/target-groups/*)
            │   ├── data-source.ts      # 데이터 소스 API (/api/data-sources/*)
            │   └── export.ts          # 내보내기 API (/api/exports/*)
            │
            ├── 📁 pages/               # 페이지 컴포넌트
            │   ├── dashboard/page.tsx  # 대시보드 페이지
            │   ├── search/page.tsx     # 검색 페이지 (메인)
            │   ├── target-groups/page.tsx  # 타겟 그룹 관리 페이지
            │   ├── data-source/page.tsx     # 데이터 소스 페이지
            │   ├── export-history/page.tsx  # 내보내기 이력 페이지
            │   ├── settings/page.tsx   # 설정 페이지
            │   └── NotFound.tsx       # 404 페이지
            │
            ├── 📁 components/           # 재사용 가능한 컴포넌트
            │   ├── BackgroundWrapper.tsx    # 배경 래퍼
            │   ├── ModernTable.tsx          # 모던 테이블 컴포넌트
            │   ├── BentoCard.tsx           # 벤토 그리드 카드
            │   ├── CountUp.tsx             # 숫자 카운트업 애니메이션
            │   │
            │   ├── 📁 base/                # 기본 UI 컴포넌트
            │   │   ├── Badge.tsx
            │   │   ├── Button.tsx
            │   │   ├── Card.tsx
            │   │   └── Chip.tsx
            │   │
            │   └── 📁 layout/              # 레이아웃 컴포넌트
            │       ├── Header.tsx          # 헤더
            │       └── Sidebar.tsx        # 사이드바 (네비게이션)
            │
            ├── 📁 features/            # 기능별 모듈 (도메인 기반 구조)
            │   │
            │   ├── 📁 panel/          # 패널 검색 기능
            │   │   ├── 📁 components/  # 패널 관련 컴포넌트
            │   │   │   ├── MagicSearchBar.tsx      # 검색 입력 바
            │   │   │   ├── ResultDashboard.tsx     # 검색 결과 대시보드
            │   │   │   ├── PersonaCard.tsx         # AI 페르소나 카드
            │   │   │   ├── PersonaLoadingState.tsx # 페르소나 로딩 상태
            │   │   │   ├── PanelListCard.tsx        # 패널 리스트 카드
            │   │   │   ├── PanelDetailSlideOver.tsx # 패널 상세 슬라이드오버
            │   │   │   ├── KPIStatCard.tsx          # KPI 통계 카드
            │   │   │   ├── BarChartCard.tsx         # 막대 차트 카드
            │   │   │   └── DonutChartCard.tsx       # 도넛 차트 카드
            │   │   └── 📁 hooks/
            │   │       └── usePanelSearch.ts        # 패널 검색 훅
            │   │
            │   └── 📁 target-group/   # 타겟 그룹 기능
            │       ├── 📁 hooks/
            │       │   └── useTargetGroup.ts       # 타겟 그룹 훅
            │       └── 📁 store/
            │           └── targetGroupStore.ts      # Zustand 스토어
            │
            ├── 📁 router/              # 라우팅 설정
            │   ├── index.tsx          # 라우터 설정
            │   ├── routes.tsx         # 라우트 정의
            │   └── config.tsx         # 라우트 설정
            │
            ├── 📁 hooks/               # React 커스텀 훅
            │   └── useDebounce.ts     # 디바운스 훅
            │
            ├── 📁 utils/               # 유틸리티 함수
            │   ├── format.ts          # 포맷팅 함수
            │   └── mockPanelData.ts   # 목업 패널 데이터
            │
            ├── 📁 types/               # TypeScript 타입 정의
            │   ├── panel.ts           # 패널 관련 타입
            │   └── target-group.ts    # 타겟 그룹 관련 타입
            │
            ├── 📁 lib/                 # 라이브러리 래퍼
            │   └── api/
            │       └── client.ts      # API 클라이언트 (axios 래퍼)
            │
            └── 📁 i18n/                # 국제화 (i18next)
                ├── index.ts           # i18n 설정
                └── local/
                    └── index.ts       # 한국어 로컬라이제이션
```

---

## 🏗️ 주요 디렉토리 상세 설명

### 📦 Backend (`panel1.0/backend/`)

#### `app/` - Flask 애플리케이션 핵심

**`routes/` - API 엔드포인트 정의**
- `search.py`: **통합 검색 API** (`POST /api/search`)
  - 자연어 질의를 받아 자동으로 전략 선택 및 검색 실행
  - SearchService 사용
- `search_routes.py`: **패널 대시보드 및 도구 API**
  - `GET /api/panel/dashboard`: 대시보드 데이터 (캐싱 적용)
  - `GET /api/tools/*`: 개발/디버깅용 도구
  - PanelDataService 사용
- `llm_routes.py`: **LLM 관련 API** (`/api/llm/*`)
  - `POST /api/llm/sql_search`: SQL 쿼리 생성 및 페르소나 생성
  - `POST /api/llm/ask`: LLM 질의응답
  - `GET /api/llm/models`: 사용 가능한 모델 목록
- `target_group_routes.py`: **타겟 그룹 관리 API** (`/api/target-groups/*`)
  - CRUD 작업, 통계, 패널 수 추정, AI 추천
- `data_source_routes.py`: **데이터 소스 관리 API** (`/api/data-sources/*`)
  - 테이블 목록, 스키마 정보, 미리보기, 에러 로그
- `export_routes.py`: **내보내기 API** (`/api/exports/*`)
  - 내보내기 이력, 파일 생성, 다운로드

**`services/` - 비즈니스 로직 계층**

- **`search/`**: 검색 서비스 (전략 패턴)
  - `service.py`: 통합 검색 서비스 (메인)
    - 자연어 질의 파싱 → 전략 선택 → 검색 실행 → Fallback 처리
  - `strategy/`: 검색 전략 구현체들
    - `base.py`: 전략 인터페이스
    - `selector.py`: 전략 선택기 (LLM 기반)
    - `filter_first.py`: 필터 우선 검색 (SQL 기반, 빠름)
    - `semantic_first.py`: 의미 검색 우선 (벡터 기반, 정확함)
    - `hybrid.py`: 하이브리드 검색 (SQL + 벡터, 최고 성능)

- **`llm/`**: LLM 상호작용
  - `client.py`: Claude API 호출 (Anthropic)
  - `parser.py`: LLM 응답 파싱 (JSON 파싱, 페르소나 추출)
  - `prompts.py`: 프롬프트 템플릿 관리

- **`data/`**: 데이터 접근 계층 (DAO)
  - `executor.py`: SQL 실행기 (안전한 쿼리 실행, SQL 인젝션 방지)
  - `sql_builder.py`: 동적 SQL 빌더 (필터 쿼리 생성)
  - `vector.py`: 벡터 검색 서비스 (pgvector 사용)
  - `panel.py`: 패널 데이터 접근
  - `target_group.py`: 타겟 그룹 데이터 접근
  - `export_history.py`: 내보내기 이력 관리

**`db/` - 데이터베이스 연결 관리**
- `connection.py`: PostgreSQL 연결 관리
  - Connection Pool 사용 (ThreadedConnectionPool)
  - 연결 재사용으로 성능 최적화

**`utils/` - 유틸리티 함수**
- `calculate_panel_count.py`: 패널 수 계산 (연령, 성별, 지역, 태그 기반)
- `generate_summary.py`: 타겟 그룹 요약 생성
- `file_generator.py`: 파일 생성 (CSV, Excel, PDF)
- `panel_schema.py`: 패널 스키마 관리 (interests 컬럼 자동 생성)

#### `scripts/` - 배포/ETL 스크립트
- **배포 스크립트**: 서버 시작/중지, 의존성 설치, 권한 설정
- **ETL 스크립트**: 데이터 적재, 메타데이터 생성, 임베딩 생성

---

### 🎨 Frontend (`panel1.0/frontend/`)

#### `src/` - 소스 코드

**`pages/` - 페이지 컴포넌트**
- `search/page.tsx`: **메인 검색 페이지** (AI 패널 검색)
  - 자연어 검색, 결과 표시, 페르소나 생성
- `dashboard/page.tsx`: 대시보드 페이지
- `target-groups/page.tsx`: 타겟 그룹 관리 페이지
- `data-source/page.tsx`: 데이터 소스 페이지
- `export-history/page.tsx`: 내보내기 이력 페이지
- `settings/page.tsx`: 설정 페이지

**`features/` - 기능별 모듈 (도메인 기반 구조)**

- **`panel/`**: 패널 검색 기능
  - `components/`: 패널 관련 컴포넌트
    - `MagicSearchBar.tsx`: 검색 입력 바 (자동완성, 필터 칩)
    - `ResultDashboard.tsx`: 검색 결과 대시보드 (통계, 차트, 테이블)
    - `PersonaCard.tsx`: AI 생성 페르소나 카드
    - `PanelListCard.tsx`: 패널 리스트 카드 (무한 스크롤)
    - 차트 컴포넌트들: `KPIStatCard`, `BarChartCard`, `DonutChartCard`
  - `hooks/usePanelSearch.ts`: 패널 검색 훅 (상태 관리, API 호출)

- **`target-group/`**: 타겟 그룹 기능
  - `hooks/useTargetGroup.ts`: 타겟 그룹 훅
  - `store/targetGroupStore.ts`: Zustand 스토어

**`components/` - 재사용 가능한 컴포넌트**
- `ModernTable.tsx`: 모던 테이블 컴포넌트 (복사 기능, 하이라이트)
- `BentoCard.tsx`: 벤토 그리드 카드
- `base/`: 기본 UI 컴포넌트 (Badge, Button, Card, Chip)
- `layout/`: 레이아웃 컴포넌트 (Header, Sidebar)

**`api/` - API 클라이언트**
- `client.ts`: Axios 인스턴스 (기본 설정, 인터셉터)
- 각 기능별 API 파일: `search.ts`, `llm.ts`, `panel.ts`, `target-group.ts` 등

**`router/` - 라우팅 설정**
- `routes.tsx`: 라우트 정의
- `index.tsx`: 라우터 설정

**`types/` - TypeScript 타입 정의**
- `panel.ts`: 패널 관련 타입
- `target-group.ts`: 타겟 그룹 관련 타입

---

## 🔄 데이터 흐름 (Data Flow)

### 검색 요청 흐름

```
1. 사용자 입력 (프론트엔드)
   └─> search/page.tsx
       └─> usePanelSearch.ts
           └─> api/search.ts
               └─> POST /api/search

2. 백엔드 처리
   └─> routes/search.py
       └─> services/search/service.py
           ├─> services/llm/parser.py (질의 파싱)
           ├─> services/search/strategy/selector.py (전략 선택)
           └─> services/search/strategy/*.py (검색 실행)
               ├─> services/data/sql_builder.py (SQL 필터)
               └─> services/data/vector.py (벡터 검색)

3. 페르소나 생성
   └─> routes/llm_routes.py
       └─> services/llm/client.py
           └─> Claude API 호출
               └─> 페르소나 JSON 파싱

4. 결과 반환
   └─> 프론트엔드 렌더링
       └─> ResultDashboard.tsx
           ├─> PersonaCard.tsx
           ├─> PanelListCard.tsx
           └─> ModernTable.tsx
```

---

## 🛠️ 기술 스택

### Backend
- **Framework**: Flask (Python)
- **Database**: PostgreSQL + pgvector (벡터 검색)
- **LLM**: Anthropic Claude API
- **Embedding**: Sentence-Transformers (BGE-M3, KoSimCSE)
- **Architecture**: 
  - Domain-Driven Design
  - Strategy Pattern (검색 전략)
  - Singleton Pattern (서비스 인스턴스)

### Frontend
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Routing**: React Router v7
- **State Management**: Zustand
- **Icons**: Lucide React
- **Auto Import**: unplugin-auto-import

---

## 📋 주요 기능

1. **AI 기반 패널 검색**
   - 자연어 쿼리로 패널 검색 ("서울 20대 남자 100명")
   - 자동 전략 선택 (filter_first, semantic_first, hybrid)
   - Fallback 처리 (결과 없을 때 대체 전략 시도)

2. **하이브리드 검색**
   - 구조화된 필터 (SQL) + 의미 검색 (벡터) 결합
   - 정확도와 성능의 균형

3. **AI 페르소나 생성**
   - 검색된 패널 그룹의 대표 페르소나 생성
   - 통계 기반 분석 (연령, 성별, 지역 분포)

4. **타겟 그룹 관리**
   - 타겟 그룹 생성/수정/삭제
   - 패널 수 추정
   - AI 추천 기능

5. **데이터 내보내기**
   - CSV, Excel, PDF 형식 지원
   - 내보내기 이력 관리

---

## 🚀 배포 구조

- **Backend**: AWS CodeDeploy (EC2)
- **Frontend**: AWS CodeDeploy (EC2)
- **CI/CD**: AWS CodeBuild + CodeDeploy
- **배포 스크립트**: `appspec.yml`에 정의된 스크립트 사용

---

## 📝 개발 가이드

### 백엔드 API 엔드포인트

- `POST /api/search`: 통합 검색
- `POST /api/llm/sql_search`: SQL 생성 및 페르소나 생성
- `GET /api/panel/dashboard`: 대시보드 데이터
- `GET /api/target-groups`: 타겟 그룹 목록
- `POST /api/target-groups`: 타겟 그룹 생성
- `GET /api/data-sources/tables`: 데이터 소스 목록
- `GET /api/exports`: 내보내기 이력

### 프론트엔드 개발

- 컴포넌트는 `src/components/` 또는 `src/features/*/components/`에 위치
- API 호출은 `src/api/`에 정의
- 페이지는 `src/pages/`에 위치
- 커스텀 훅은 `src/hooks/` 또는 `src/features/*/hooks/`에 위치

---

## ⚠️ 주의사항

1. **환경 변수**: `.env` 파일은 Git에 커밋되지 않음 (`.gitignore`에 포함)
2. **가상환경**: `venv/` 폴더는 Git에 커밋되지 않음
3. **빌드 산출물**: `out/`, `node_modules/`, `__pycache__/` 등은 Git 무시
4. **대용량 파일**: `model_cache/`, `exports/` 등은 Git LFS 또는 무시 처리

---

## 📚 추가 문서

- `README.md`: 프로젝트 개요 및 설치 방법
- `PROJECT_LOGIC.md`: 프로젝트 로직 상세 설명
- `panel1.0/backend/REFACTORING_SUMMARY.md`: 리팩토링 요약
