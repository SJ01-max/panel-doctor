
# 0. Getting Started (시작하기)
```bash
백엔드(Flask): python main.py  
프론트엔드(React + Vite): npm run dev

```


<br/>
<br/>

# 1. Project Overview (프로젝트 개요)
- 프로젝트 이름: Panel System
- 프로젝트 설명: Panel Doctor는 자연어 기반 패널 분석 시스템으로, 사용자가 입력한 질의를 LLM이 의미적으로 해석하여 SQL 기반 검색과 임베딩 기반 유사도 검색을 결합해 가장 유사한 패널을 추출합니다.
또한 분포 분석, 패턴 분석, 핵심 키워드 등을 대시보드로 시각화하여 제공하는 AI 분석 플랫폼입니다.

<br/>
<br/>

# 2. Team Members (팀원 및 팀 소개)
| 허성재 | 김우준 | 김완진 | 김종욱 | 최석진 | 홍재민 |
|:------:|:------:|:------:|:------:|:------:|:------:|
| <img src="https://github.com/user-attachments/assets/c1c2b1e3-656d-4712-98ab-a15e91efa2da" alt="허성재" width="150"> | <img src="https://github.com/user-attachments/assets/c1c2b1e3-656d-4712-98ab-a15e91efa2da" alt="김우준" width="150"> | <img src="https://github.com/user-attachments/assets/c1c2b1e3-656d-4712-98ab-a15e91efa2da" alt="김완진" width="150"> | <img src="https://github.com/user-attachments/assets/c1c2b1e3-656d-4712-98ab-a15e91efa2da" alt="김종욱" width="150"> | <img src="https://github.com/user-attachments/assets/c1c2b1e3-656d-4712-98ab-a15e91efa2da" alt="최석진" width="150"> | <img src="https://github.com/user-attachments/assets/c1c2b1e3-656d-4712-98ab-a15e91efa2da" alt="홍재민" width="150"> |
| BE/FE/전체총괄 | BE | BE | BE | BE | FE |

<br/>
<br/>

# 3. Key Features (주요 기능)
- **자연어 기반 패널 검색**:
  - 사용자가 자연어로 질의하면 LLM이 자동으로 최적의 검색 전략을 선택하여 실행합니다.
  - 예시: "서울 20대 남자 100명", "운동 좋아하는 30대 여성"

- **하이브리드 검색 시스템**:
  - Filter First: 구조화된 필터 기반 검색 (SQL, 빠른 응답)
  - Semantic First: 의미 기반 벡터 검색 (정확한 의미 매칭)
  - Hybrid: 구조화된 필터 + 벡터 검색 결합 (최고 성능)

- **핵심 키워드 추출 및 분석**:
  - 검색된 패널 그룹의 응답을 분석하여 핵심 키워드를 자동 추출합니다.
  - 임베딩 기반 키워드 추출 (TF-IDF) 및 키워드 통계 분석
  - 키워드 간 연관성 분석 (강한/중간/독립 키워드)을 통해 인사이트를 제공합니다.

- **타겟 그룹 관리**:
  - 타겟 그룹 생성, 수정, 삭제 기능
  - 패널 수 추정 및 AI 기반 타겟 그룹 추천

- **데이터 시각화**:
  - 검색 결과를 대시보드로 시각화 (차트, 통계, 분포 분석)
  - 연령대별/성별별/지역별 분포 분석

- **데이터 내보내기**:
  - 검색 결과를 CSV, Excel, PDF 형식으로 내보내기
  - 내보내기 이력 관리

<br/>
<br/>

# 4. Tasks & Responsibilities (작업 및 역할 분담)
|  |  |  |
|-----------------|-----------------|-----------------|
| 허성재    |  <img src="https://github.com/user-attachments/assets/c1c2b1e3-656d-4712-98ab-a15e91efa2da" alt="허성재" width="100"> | <ul><li>프로젝트 전체 총괄</li><li>백엔드/프론트엔드 아키텍처 설계</li><li>검색 서비스 및 전략 패턴 구현</li><li>LLM 통합 및 프롬프트 엔지니어링</li></ul>     |
| 김우준   |  <img src="https://github.com/user-attachments/assets/c1c2b1e3-656d-4712-98ab-a15e91efa2da" alt="김우준" width="100">| <ul><li>백엔드 API 개발</li><li>벡터 검색 서비스 구현</li><li>데이터베이스 최적화</li></ul> |
| 김완진   |  <img src="https://github.com/user-attachments/assets/c1c2b1e3-656d-4712-98ab-a15e91efa2da" alt="김완진" width="100">    |<ul><li>백엔드 서비스 레이어 개발</li><li>타겟 그룹 관리 기능 구현</li><li>데이터 내보내기 기능 구현</li></ul>  |
| 김종욱    |  <img src="https://github.com/user-attachments/assets/c1c2b1e3-656d-4712-98ab-a15e91efa2da" alt="김종욱" width="100">    | <ul><li>백엔드 데이터 접근 계층 구현</li><li>SQL 빌더 및 쿼리 최적화</li><li>ETL 스크립트 개발</li></ul>    |
| 최석진    |  <img src="https://github.com/user-attachments/assets/c1c2b1e3-656d-4712-98ab-a15e91efa2da" alt="최석진" width="100">    | <ul><li>백엔드 API 엔드포인트 개발</li><li>데이터 소스 관리 기능 구현</li><li>시스템 모니터링 및 로깅</li></ul>    |
| 홍재민    |  <img src="https://github.com/user-attachments/assets/c1c2b1e3-656d-4712-98ab-a15e91efa2da" alt="홍재민" width="100">    | <ul><li>프론트엔드 UI/UX 개발</li><li>검색 페이지 및 대시보드 구현</li><li>데이터 시각화 컴포넌트 개발</li><li>반응형 디자인 구현</li></ul>    |

<br/>

# 5. Technology Stack (기술 스택)
## 5.1 Language
|  |  |
|-----------------|-----------------|
| Python    |   <img src="https://github.com/user-attachments/assets/60140ded-2ac1-41d7-9db2-ae26fc9de43a" alt="Python" width="100">| 
| TypeScript    |   <img src="https://github.com/user-attachments/assets/cdd511f1-7bc1-494f-94da-906ac82dbc5c" alt="TypeScript" width="100">|


<br/>


## 5.2 Frotend
## 5.2 Frontend
|  |  |  |
|-----------------|-----------------|-----------------|
| React    |  <img src="https://github.com/user-attachments/assets/e3b49dbb-9804-acf9-012c854a2fd2" alt="React" width="100"> | 19.1.0   |
| TypeScript    |  <img src="https://github.com/user-attachments/assets/c9b26078-5d79-40cc-b120-69d9b3882786" alt="TypeScript" width="100">| 5.8.3   |
| Vite    |  <img src="https://github.com/user-attachments/assets/75a46fa7-ebc0-4a9d-b648-c589f87c4b55" alt="Vite" width="100">    | 7.0.3  |
| Tailwind CSS    |  <img src="https://github.com/user-attachments/assets/3632d7d6-8d43-4dd5-ba7a-501a2bc3a3e4" alt="Tailwind CSS" width="100">    | 3.4.17    |
| Recharts    |  <img src="https://github.com/user-attachments/assets/3632d7d6-8d43-4dd5-ba7a-501a2bc3a3e4" alt="Recharts" width="100">    | 3.2.0    |
| Zustand    |  <img src="https://github.com/user-attachments/assets/3632d7d6-8d43-4dd5-ba7a-501a2bc3a3e4" alt="Zustand" width="100">    | 5.0.8    |
| Framer Motion    |  <img src="https://github.com/user-attachments/assets/3632d7d6-8d43-4dd5-ba7a-501a2bc3a3e4" alt="Framer Motion" width="100">    | 12.23.24    |
<br/>

## 5.3 Backend
|  |  |  |
|-----------------|-----------------|-----------------|
| Flask    |  <img src="https://github.com/user-attachments/assets/4937976f-8466-4a71-80c4-7e5bc21d5aff" alt="Flask" width="100">    | 3.0.0+    |
| PostgreSQL    |  <img src="https://github.com/user-attachments/assets/c245860e-c53e-4595-8d38-3623db5055a7" alt="PostgreSQL" width="100">    | -    |
| pgvector   |  <img src="https://github.com/user-attachments/assets/ef455654-d04b-4add-b77e-4a2f3fde8182" alt="pgvector" width="100">    | 0.2.0+    |
| Anthropic Claude API   |  <img src="https://github.com/user-attachments/assets/6598b89f-7e98-4898-96fe-b44b300528d5" alt="Claude" width="100">    | -    |
| Sentence-Transformers    |  <img src="https://github.com/user-attachments/assets/4c690fd4-721b-4303-af31-aa4dbcc641ea" alt="Sentence-Transformers" width="100">    | 2.2.0+    |
| PyTorch    |  <img src="https://github.com/user-attachments/assets/4c690fd4-721b-4303-af31-aa4dbcc641ea" alt="PyTorch" width="100">    | 2.0.0+    |
| TensorFlow    |  <img src="https://github.com/user-attachments/assets/4c690fd4-721b-4303-af31-aa4dbcc641ea" alt="TensorFlow" width="100">    | 2.13.0+    |

<br/>

## 5.4 Cooperation
|  |  |
|-----------------|-----------------|
| Git    |  <img src="https://github.com/user-attachments/assets/483abc38-ed4d-487c-b43a-3963b33430e6" alt="git" width="100">    |
| Figma    |  <img src="https://github.com/user-attachments/assets/00eca926-8fb1-46ce-86e8-35119c519ce0" alt="figma" width="100">    |
| Notion    |  <img src="https://github.com/user-attachments/assets/34141eb9-deca-416a-a83f-ff9543cc2f9a" alt="Notion" width="100">    |


<br/>

# 6. API 명세서

## 주요 API 엔드포인트

### 검색 API
- `POST /api/search` - 통합 검색 (자연어 질의)
- `POST /api/semantic-search` - 시맨틱 검색 (의미 기반 벡터 검색)

### LLM API
- `POST /api/llm/ask` - LLM 질의응답
- `POST /api/llm/sql_search` - SQL 검색 (대화 히스토리 지원)
- `GET /api/llm/models` - 사용 가능한 모델 목록

### 패널 API
- `GET /api/panel/dashboard` - 대시보드 데이터

### 타겟 그룹 API
- `GET /api/target-groups` - 타겟 그룹 목록
- `POST /api/target-groups` - 타겟 그룹 생성
- `PUT /api/target-groups/:id` - 타겟 그룹 수정
- `DELETE /api/target-groups/:id` - 타겟 그룹 삭제

### 내보내기 API
- `GET /api/exports` - 내보내기 이력
- `POST /api/exports` - 파일 생성 요청
- `GET /api/exports/:id/download` - 파일 다운로드

  
# 7. Project Structure (프로젝트 구조)
```plaintext
panel-doctor/
├── panel1.0/
│   ├── backend/                    # Flask 백엔드
│   │   ├── app/
│   │   │   ├── __init__.py        # Flask 앱 팩토리
│   │   │   ├── config.py          # 설정 파일
│   │   │   ├── routes/            # API 라우트
│   │   │   │   ├── search.py      # 통합 검색 API
│   │   │   │   ├── llm_routes.py  # LLM API
│   │   │   │   └── ...
│   │   │   ├── services/          # 비즈니스 로직
│   │   │   │   ├── search/        # 검색 서비스 (전략 패턴)
│   │   │   │   ├── llm/           # LLM 서비스
│   │   │   │   └── data/          # 데이터 접근 계층
│   │   │   └── db/                # 데이터베이스 연결
│   │   ├── main.py                # 서버 진입점
│   │   └── requirements.txt       # Python 의존성
│   │
│   └── frontend/                   # React 프론트엔드
│       ├── src/
│       │   ├── pages/             # 페이지 컴포넌트
│       │   │   ├── search/        # 검색 페이지
│       │   │   ├── dashboard/      # 대시보드 페이지
│       │   │   ├── target-groups/  # 타겟 그룹 페이지
│       │   │   └── ...
│       │   ├── components/        # 재사용 컴포넌트
│       │   ├── features/          # 기능별 모듈
│       │   │   ├── panel/         # 패널 검색 기능
│       │   │   └── target-group/  # 타겟 그룹 기능
│       │   ├── api/               # API 클라이언트
│       │   ├── router/            # 라우팅 설정
│       │   └── types/             # TypeScript 타입
│       ├── package.json           # Node.js 의존성
│       └── vite.config.js         # Vite 설정
│
├── PROJECT_STRUCTURE.md           # 프로젝트 구조 상세 문서
├── PROJECT_LOGIC.md               # 프로젝트 로직 문서
└── README.md                      # 프로젝트 개요
```

<br/>
<br/>

# 8. Development Workflow (개발 워크플로우)
## 브랜치 전략 (Branch Strategy)
우리의 브랜치 전략은 Git Flow를 기반으로 하며, 다음과 같은 브랜치를 사용합니다.

- **Main Branch**
  - 배포 가능한 상태의 코드를 유지합니다.
  - 모든 배포는 이 브랜치에서 이루어집니다.
  
- **{test} Branch**
  - 팀원 각자의 개발 브랜치입니다.
  - 모든 기능 개발은 이 브랜치에서 이루어집니다.
<br/>
<br/>



<br/>




## 커밋 이모지
```
== 코드 관련
📝	코드 작성
🔥	코드 제거
🔨	코드 리팩토링
💄	UI / style 변경

== 문서&파일
📰	새 파일 생성
🔥	파일 제거
📚	문서 작성

== 버그
🐛	버그 리포트
🚑	버그를 고칠 때

== 기타
🐎	성능 향상
✨	새로운 기능 구현
💡	새로운 아이디어
🚀	배포
```

<br/>

## 커밋 예시
```
== ex1
✨Feat: "자연어 검색 기능 구현"

LLM 기반 쿼리 파싱 및 검색 전략 자동 선택 기능 개발

== ex2
📚chore: sentence-transformers 라이브러리 설치

임베딩 모델 사용을 위한 sentence-transformers 설치
```

<br/>
<br/>

# 11. 컨벤션 수행 결과
<img width="100%" alt="코드 컨벤션" src="https://github.com/user-attachments/assets/0dc218c0-369f-45d2-8c6d-cdedc81169b4">
<img width="100%" alt="깃플로우" src="https://github.com/user-attachments/assets/2a4d1332-acc2-4292-9815-d122f5aea77c">







