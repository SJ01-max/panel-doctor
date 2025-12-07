# 0. Getting Started (시작하기)
```bash
백엔드(Flask): python main.py  
프론트엔드(React + Vite): npm run dev

<br/><br/>
1. Project Overview (프로젝트 개요)

프로젝트 이름: Panel Doctor

프로젝트 설명:
Panel Doctor는 자연어 기반 패널 분석 시스템으로, 사용자가 입력한 질의를 LLM이 의미적으로 해석하여
SQL 기반 검색과 임베딩 기반 유사도 검색을 결합해 가장 유사한 패널을 추출합니다.
또한 분포 분석, 패턴 분석, 핵심 키워드 등을 대시보드로 시각화하여 제공하는 AI 분석 플랫폼입니다.

<br/><br/>

2. Team Members (팀원 및 팀 소개)
허성재(팀장)	김우준	김완진	김종욱	최석진	홍재민
<img src="https://github.com/user-attachments/assets/beea8c64-19de-4d91-955f-ed24b813a638" width="150">	<img src="https://github.com/user-attachments/assets/placeholder1" width="150">	<img src="https://github.com/user-attachments/assets/placeholder2" width="150">	<img src="https://github.com/user-attachments/assets/placeholder3" width="150">	<img src="https://github.com/user-attachments/assets/placeholder4" width="150">	<img src="https://github.com/user-attachments/assets/placeholder5" width="150">
FE / 전체 총괄	DB	AI/LLM	임베딩	FE	서버/데이터
GitHub
	GitHub	GitHub	GitHub	GitHub	GitHub

<br/><br/>

3. Key Features (주요 기능)

자연어 기반 패널 검색

사용자의 자연어 질의를 LLM이 구조화·분류하여 적절한 검색 방식(SQL/semantic)을 자동 적용합니다.

의미 기반 임베딩 검색

bge-m3-ko, KURE-v1 등 최신 임베딩 모델 사용

pgvector 기반 유사도 검색 지원

패널 분포 대시보드

연령/성별/지역 기반 분포 및 전체 데이터 대비 비율 분석 제공

패턴 분석 & 키워드 탐색

LLM이 패널들의 공통 특징을 분석하여 자연어 형태로 설명

주요 키워드 TOP7 자동 산출

SQL 안전 실행

SELECT/WITH만 허용하며 timeout 및 파라미터 바인딩 적용

실시간 웹 UI

검색 → 분석 → 결과까지 모든 기능을 웹에서 실시간 제공

<br/><br/>

4. Tasks & Responsibilities (작업 및 역할 분담)
팀원	사진	역할
허성재(팀장)	<img src="https://github.com/user-attachments/assets/beea8c64-19de-4d91-955f-ed24b813a638" width="100">	전체 아키텍처 총괄, UI/UX 개발, 대시보드 구현
김우준	<img src="https://github.com/user-attachments/assets/placeholder1" width="100">	DB 스키마 구성, 데이터 정제, ETL 구축
김완진	<img src="https://github.com/user-attachments/assets/placeholder2" width="100">	LLM Prompt 설계, 질의 분류 모델 구현
김종욱	<img src="https://github.com/user-attachments/assets/placeholder3" width="100">	임베딩 파이프라인 구축, 벡터DB 최적화
최석진	<img src="https://github.com/user-attachments/assets/placeholder4" width="100">	프론트엔드 기능 개발, 검색 UI 개선
홍재민	<img src="https://github.com/user-attachments/assets/placeholder5" width="100">	서버 API 개발, 데이터 핸들링, 배포 지원
<br/>
5. Technology Stack (기술 스택)
5.1 Language
언어	아이콘
Python	🐍
TypeScript	🟦
<br/>
5.2 Frontend
기술	아이콘	설명
React	⚛️	UI 컴포넌트 기반 프레임워크
Vite	⚡	초고속 프론트엔드 빌드 도구
TailwindCSS	🎨	유틸리티 기반 CSS 프레임워크
Recharts	📊	차트 기반 데이터 시각화
<br/>
5.3 Backend
기술	아이콘	버전
Flask	🔥	^3.x
PostgreSQL	🐘	15.x
pgvector	🔢	최신
Claude API	🤖	sonnet-4.5
<br/>
5.4 Cooperation
도구	아이콘
Git	🧬
Notion	📒
Figma	🎨
<br/>
6. API 명세서
<p> <img src="https://github.com/user-attachments/assets/893fc270-6a96-499f-b456-3f9e5b481120" alt="API 기본 명세서 예시" width="600" /> </p>

API 문서는 팀 내부 Notion에서 관리합니다.

<br/><br/>

6. Project Structure (프로젝트 구조)
panel-doctor/
├── README.md
├── PROJECT_LOGIC.md
├── PROJECT_STRUCTURE.md
│
├── panel1.0/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── routes/          # SQL/semantic search API
│   │   │   ├── services/        # LLM, embedding, search logic
│   │   │   ├── db/              # DB connection layer
│   │   │   └── utils/
│   │   ├── scripts/             # ETL, embedding, benchmarking
│   │   ├── tests/
│   │   ├── main.py
│   │   └── requirements.txt
│   │
│   └── frontend/
│       ├── src/
│       │   ├── api/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── features/
│       │   └── router/
│       ├── package.json
│       ├── vite.config.js
│       └── tailwind.config.cjs
│
└── .gitignore


<br/><br/>

7. Development Workflow (개발 워크플로우)
브랜치 전략 (Git Flow 기반)

Main Branch

배포 가능한 코드 보관

최종 안정 버전 유지

{name} Branch

팀원별 기능 개발 브랜치

모든 개발은 개인 브랜치에서 진행 후 main으로 Merge

<br/><br/>

8. Coding Convention
문장 종료
console.log("Hello World!");

명명 규칙

상수 → UPPER_SNAKE_CASE

변수 & 함수 → camelCase

컴포넌트 → PascalCase

boolean → isLoading, isValid

예시
const getPanelList = () => {...}
const onClickButton = () => {}

블록 구문
if (true) {
  return "hello";
}

함수
const fetchPanels = () => {};

styled-components 네이밍
<Container>
  <SectionArea>
    <Item>...</Item>
  </SectionArea>
</Container>

폴더 네이밍
camelCase
PascalCase (컴포넌트 전용)

파일 네이밍
컴포넌트: .jsx  
일반 로직: .js  
customHook: use + Name


<br/><br/>

9. Commit Convention
기본 구조
type: subject

body

Type 종류
feat, fix, docs, style, refactor, test, chore

이모지 규칙
✨ 신규 기능
🐛 버그
📝 코드 수정
📚 문서
🔥 제거
🚀 배포

Commit Example
✨ feat: "자연어 질의 분석 기능 추가"
- LLM 기반 질의 분류 기능 구현


<br/><br/>

10. 컨벤션 수행 결과

(코드 컨벤션 스크린샷, Git Flow 스크린샷 첨부)

📄 LICENSE

본 프로젝트는 교육 및 연구 목적의 비상업적 프로젝트입니다.
