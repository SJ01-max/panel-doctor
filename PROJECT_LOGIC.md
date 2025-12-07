# Panel Doctor 프로젝트 로직 상세 문서

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [아키텍처 구조](#아키텍처-구조)
3. [API 엔드포인트 상세](#api-엔드포인트-상세)
4. [서비스 클래스 상세](#서비스-클래스-상세)
5. [데이터베이스 구조](#데이터베이스-구조)
6. [처리 흐름 상세](#처리-흐름-상세)
7. [쿼리 타입별 처리](#쿼리-타입별-처리)
8. [임베딩 및 벡터 검색](#임베딩-및-벡터-검색)

---

## 프로젝트 개요

**Panel Doctor**는 자연어 질의를 통해 패널(응답자) 데이터를 검색하고 분석하는 시스템입니다.

### 주요 기능
- **구조화된 패널 검색**: 성별, 연령대, 지역 등 구조화된 필터 기반 검색
- **의미 기반 검색**: 임베딩 벡터를 사용한 의미 기반 검색
- **하이브리드 검색**: 구조화된 필터 + 의미 검색 결합
- **분석 질문 처리**: 연령대별/성별별/지역별 분포 분석

### 기술 스택
- **Backend**: Python (Flask)
- **Database**: PostgreSQL + pgvector
- **LLM**: Anthropic Claude API
- **Embedding**: KURE v1 (1024차원, 한국어 특화)
- **Frontend**: React + TypeScript

---

## 아키텍처 구조

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│              (React + TypeScript)                           │
└────────────────────┬──────────────────────────────────────┘
                     │ HTTP Request
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ /api/panel/ │  │ /api/llm/    │  │ /api/tools/  │     │
│  │   search    │  │ semantic_    │  │ execute_sql  │     │
│  │             │  │   search     │  │             │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
└─────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │PanelService  │  │LlmService    │  │VectorSearch  │     │
│  │              │  │              │  │Service       │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
└─────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │core.join_   │  │core.doc_     │  │core.doc_     │     │
│  │clean        │  │embedding_    │  │embedding     │     │
│  │             │  │view         │  │              │     │
│  └─────────────┘  └──────┬──────┘  └──────┬──────┘     │
│                           │                 │            │
│                           └────────┬────────┘            │
│                                    │ JOIN                │
│                                    ▼                     │
│                          v.doc_id = e.doc_id             │
└──────────────────────────────────────────────────────────┘
```

---

## API 엔드포인트 상세

### 1. `/api/panel/search` (POST)

**목적**: 구조화된 필터 기반 패널 검색

**요청 형식**:
```json
{
  "query": "서울 20대 남자 100명",
  "previous_panel_ids": ["id1", "id2", ...]  // 선택사항
}
```

**처리 흐름**:
```
1. EnhancedQueryParser.parse()
   → LLM으로 자연어 파싱
   → 구조화된 필터 추출 (gender, age_range, region, limit)

2. PanelService.search()
   → 필터 조건을 SQL WHERE 절로 변환
   → core.join_clean 테이블에서 검색
   → 의미 검색 키워드 감지 시 VectorSearchService 사용

3. 결과 반환
   → panelIds: 패널 ID 목록
   → samplePanels: 샘플 데이터
   → distributionStats: 성별/연령대/지역 분포
```

**응답 형식**:
```json
{
  "extractedChips": ["서울", "20대", "남자", "100명"],
  "previewData": [
    {"columnHuman": "지역", "columnRaw": "region", "operator": "LIKE", "value": "서울"},
    {"columnHuman": "연령", "columnRaw": "age_text", "operator": "BETWEEN", "value": "20-29세"},
    {"columnHuman": "성별", "columnRaw": "gender", "operator": "=", "value": "남"}
  ],
  "estimatedCount": 756,
  "panelIds": ["w291516899167465", "w462602481665114", ...],
  "samplePanels": [...],
  "distributionStats": {
    "gender": [{"label": "남", "value": 60}, {"label": "여", "value": 40}],
    "age": [{"label": "20대", "value": 100}],
    "region": [...]
  }
}
```

---

### 2. `/api/llm/semantic_search` (POST)

**목적**: 의미 기반 벡터 검색 (임베딩 사용)

**요청 형식**:
```json
{
  "question": "운동 좋아하는 사람",
  "model": "claude-3-5-haiku-latest"  // 선택사항
}
```

**처리 흐름**:
```
1. COUNT 쿼리 감지
   → "몇명", "개수" 등 키워드 확인
   → is_count_query = True면 LIMIT = None

2. 쿼리 분류 (classify_and_extract_query)
   → LLM이 질문 분석
   → 타입 분류: structured / semantic / hybrid / analytical / error

3. 타입별 처리 분기
   ├─ analytical → handle_analytical_query()
   ├─ structured → SQL 직접 실행
   ├─ hybrid → 구조적 필터 + 벡터 검색
   └─ semantic → 벡터 검색만

4. 결과 요약 (LLM 사용)
   → 검색 결과를 바탕으로 자연어 요약 생성
```

**응답 형식**:
```json
{
  "type": "semantic" | "hybrid" | "structured" | "analytical",
  "search_text": "운동을 좋아하는 사람들",
  "filters": {...},  // hybrid인 경우
  "sql": "SELECT ... ORDER BY distance LIMIT 10",
  "results": [...],
  "summary": "검색 결과 요약...",
  "result_count": 10,
  "total_count": 100,
  "distribution": [...]  // analytical인 경우
}
```

---

### 3. `/api/llm/ask` (POST)

**목적**: 일반 LLM 질의 (SQL 툴 사용 가능)

**요청 형식**:
```json
{
  "prompt": "질문 내용",
  "model": "claude-3-5-haiku-latest"  // 선택사항
}
```

**처리**: `LlmService.ask_with_tools()` 사용

---

### 4. `/api/llm/sql_search` (POST)

**목적**: SQL 검색 (대화 히스토리 지원)

**요청 형식**:
```json
{
  "prompt": "질문 내용",
  "model": "claude-3-5-haiku-latest",
  "conversation_history": [...],
  "panel_search_result": {...}
}
```

**처리**: `LlmService.ask_for_sql_rows()` 사용

---

## 서비스 클래스 상세

### 1. LlmService

**위치**: `app/services/llm_service.py`

**주요 메서드**:

#### `classify_and_extract_query(user_query: str) -> Dict[str, Any]`

**목적**: 자연어 질의를 분류하고 정보 추출

**처리 과정**:
1. LLM에게 시스템 프롬프트 전달
2. 질문 타입 분류 (structured/semantic/hybrid/analytical/error)
3. 구조화된 필터 추출 (gender, age_range, region)
4. 요청 개수 추출 (limit)
5. 의미 검색 텍스트 추출 (search_text)

**반환 형식**:
```python
{
    "type": "semantic",
    "filters": {
        "gender": "M" | "F" | null,
        "age_range": "20s" | "30s" | ... | null,
        "region": "서울" | "부산" | null,
        "other_filters": {...} | null
    },
    "limit": 100 | null,
    "search_text": "운동을 좋아하는 사람들" | null,
    "group_by": "age_range" | "gender" | "region" | null,  # analytical인 경우
    "analysis_type": "distribution" | "comparison" | "most_frequent" | null
}
```

**타입 분류 규칙**:
- **structured**: 인구통계 필터만 (성별, 연령대, 지역)
- **semantic**: 의미 기반 조건만 (선호도, 태도, 행동)
- **hybrid**: 인구통계 + 의미 기반
- **analytical**: 분포/비교 질문 ("어떤 연령대가", "가장 많은")
- **error**: 처리 불가능한 질문

---

#### `generate_semantic_search_sql(user_question: str) -> Dict[str, Any]`

**목적**: 의미 검색을 위한 SQL 쿼리 생성

**처리 과정**:
1. LLM에게 SQL 생성 프롬프트 전달
2. 타입별 SQL 템플릿 생성
3. `<VECTOR>` 플레이스홀더 포함 SQL 반환

**반환 형식**:
```python
{
    "type": "semantic" | "hybrid" | "structured",
    "search_text": "운동을 좋아하는 사람들",
    "filters": {...},  # hybrid인 경우
    "sql": "SELECT ... ORDER BY distance LIMIT 10"
}
```

**SQL 템플릿**:
```sql
-- Semantic/Hybrid 쿼리
SELECT 
    v.doc_id,
    v.embedding_text AS content,
    v.gender,
    v.age_text,
    v.region,
    e.embedding <=> '<VECTOR>'::vector AS distance
FROM core.doc_embedding_view v
JOIN core.doc_embedding e ON v.doc_id = e.doc_id
WHERE ...  -- hybrid인 경우 구조적 필터
ORDER BY distance
LIMIT 10;
```

---

### 2. VectorSearchService

**위치**: `app/services/vector_search_service.py`

**주요 메서드**:

#### `__init__()`

**초기화 과정**:
1. DB 임베딩 차원 자동 감지 (core.doc_embedding 테이블)
2. 로컬 임베딩 모델 로딩 (KURE v1)
3. 차원 일치 확인 (DB vs 로컬 모델)

**사용 모델**: `nlpai-lab/KURE-v1` (1024차원, 한국어 특화)

---

#### `get_query_embedding(query_text: str) -> List[float]`

**목적**: 텍스트를 임베딩 벡터로 변환

**처리**:
```python
embedding = self.local_embedding_model.encode(query_text.strip()).tolist()
return embedding  # [0.123, -0.456, ..., 0.789] (1024차원)
```

---

#### `execute_semantic_search_sql(sql_query: str, embedding_input: str, limit: int = 10, distance_threshold: float = None) -> List[Dict]`

**목적**: SQL 쿼리의 `<VECTOR>` 플레이스홀더를 실제 임베딩으로 교체하고 실행

**처리 과정**:
1. `embedding_input` 텍스트를 임베딩 벡터로 변환
2. 벡터를 PostgreSQL vector 타입 문자열로 변환: `[0.123, -0.456, ...]`
3. SQL에서 `<VECTOR>` 플레이스홀더를 벡터 문자열로 교체
4. 유사도 임계값 적용 (distance_threshold가 있는 경우)
5. SQL 실행 및 결과 반환

**SQL 검증**:
- SELECT 쿼리만 허용
- 필수 JOIN 구조 확인 (core.doc_embedding_view + core.doc_embedding)
- ORDER BY distance 필수
- LIMIT 검증

**성능 최적화**:
- HNSW 인덱스 확인 및 사용 권장
- doc_id 인덱스 확인
- 실행 계획(EXPLAIN) 확인

---

### 3. PanelService

**위치**: `app/services/panel_service.py`

**주요 메서드**:

#### `search(parsed_query: Dict, previous_panel_ids: List[str] = None) -> Dict`

**목적**: 파싱된 쿼리를 기반으로 패널 검색

**처리 과정**:
1. LLM 파싱 결과에서 필터 추출
2. 의미 검색 키워드 감지 ('좋아', '선호', '취미', '관심')
3. 의미 검색 수행 (needs_semantic이 True인 경우)
4. 대상 테이블 결정 (core.join_clean 또는 core.poll_question)
5. WHERE 조건 생성 및 SQL 실행
6. 결과 집계 및 통계 생성

**의미 검색 통합**:
```python
if structured.get('needs_semantic', False) and semantic_keywords:
    semantic_panel_ids = self.vector_search.extract_panel_ids_from_semantic_search(
        query_text=text,
        semantic_keywords=semantic_keywords
    )
    # semantic_panel_ids를 WHERE 조건에 추가
```

---

## 데이터베이스 구조

### 주요 테이블

#### 1. `core.join_clean`

**목적**: 정제된 패널 데이터 (구조화된 필터 검색용)

**주요 컬럼**:
- `respondent_id` (TEXT): 패널 고유 ID
- `gender` (TEXT): 성별 ('남', '여', 'M', 'F' 등)
- `age_text` (TEXT): 나이 텍스트 ("1987년 06월 29일 (만 38 세)")
- `region` (TEXT): 거주 지역 (시/구 단위, 예: "서울특별시 성북구")
- `survey_datetime` (TIMESTAMP): 설문 시각
- `q_concat` (TEXT): 질문 답변 번호 연결

**사용 예시**:
```sql
SELECT respondent_id 
FROM core.join_clean
WHERE region LIKE '%서울%'
  AND CAST(SUBSTRING(age_text FROM '만 (\d+) 세') AS INTEGER) BETWEEN 20 AND 29
  AND gender = '남'
LIMIT 100;
```

---

#### 2. `core.doc_embedding_view`

**목적**: 임베딩용 텍스트 데이터 뷰

**주요 컬럼**:
- `doc_id` (BIGINT): 문서 ID (임베딩과 JOIN)
- `embedding_text` (TEXT): 임베딩에 사용된 원본 텍스트
- `gender` (TEXT): 성별
- `age_text` (TEXT): 나이 텍스트
- `region` (TEXT): 지역
- `respondent_id` (TEXT): 패널 ID
- `poll_code` (TEXT): 설문 코드
- `survey_datetime` (TIMESTAMP): 설문 시각
- `doc_type` (TEXT): 문서 타입

---

#### 3. `core.doc_embedding`

**목적**: 임베딩 벡터 저장

**주요 컬럼**:
- `doc_id` (BIGINT): 문서 ID (doc_embedding_view와 JOIN)
- `embedding` (VECTOR(1024)): 임베딩 벡터 (KURE v1, 1024차원)
- `model_name` (TEXT): 사용된 모델명
- `created_at` (TIMESTAMP): 생성 시각

**인덱스**:
- HNSW 인덱스 (벡터 검색 최적화)
- doc_id 인덱스 (JOIN 성능)

---

### JOIN 구조

```sql
SELECT 
    v.doc_id,
    v.embedding_text,
    v.gender,
    v.age_text,
    v.region,
    e.embedding <=> '<VECTOR>'::vector AS distance
FROM core.doc_embedding_view v
JOIN core.doc_embedding e ON v.doc_id = e.doc_id
ORDER BY distance
LIMIT 10;
```

---

## 처리 흐름 상세

### 전체 흐름도

```
사용자 질문 입력
    │
    ▼
┌─────────────────────────────────────┐
│  /api/llm/semantic_search (POST)    │
└──────────────┬──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ COUNT 쿼리 감지      │
    │ ("몇명", "개수" 등)  │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ classify_and_extract │
    │ _query()             │
    │ (LLM 분류)           │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ 타입 분기            │
    └──────┬───────────────┘
           │
    ┌──────┴──────┬──────────┬──────────┐
    │             │          │          │
    ▼             ▼          ▼          ▼
analytical   structured  hybrid    semantic
    │             │          │          │
    │             │          │          │
    ▼             ▼          ▼          ▼
[별도 처리]   [SQL 실행]  [필터+벡터] [벡터만]
    │             │          │          │
    └─────────────┴──────────┴──────────┘
                   │
                   ▼
         ┌──────────────────┐
         │ 결과 요약 (LLM)  │
         └────────┬─────────┘
                  │
                  ▼
            응답 반환
```

---

### 단계별 상세 처리

#### 1단계: COUNT 쿼리 감지

```python
count_keywords = ['총 몇명', '몇명', '개수', '몇 개', '총 몇', '전체 몇', '모두 몇', '몇 명', '총 몇 명']
is_count_query = any(keyword in question for keyword in count_keywords)
search_limit = None if is_count_query else 10
```

**효과**:
- COUNT 쿼리: LIMIT 없이 전체 결과 반환
- 일반 쿼리: 기본값 10개로 제한

---

#### 2단계: 쿼리 분류

```python
classification_result = llm_service.classify_and_extract_query(question, model=model)
query_type = classification_result.get('type', 'semantic')
```

**LLM 프롬프트 요약**:
- 프로젝트 아키텍처 설명
- 타입 분류 규칙
- 필터 추출 규칙
- JSON 출력 형식

---

#### 3단계: 타입별 처리

##### analytical 타입

```python
if query_type == 'analytical':
    return handle_analytical_query(question, classification_result, llm_service, model)
```

**처리 과정**:
1. 의미 기반 검색으로 관련 패널 1000개 찾기
2. 검색된 패널의 doc_id 추출
3. GROUP BY 기준에 따라 집계 쿼리 생성
4. 집계 결과 요약 생성

**집계 쿼리 예시**:
```sql
-- 연령대별 집계
SELECT 
    CASE 
        WHEN CAST(SUBSTRING(age_text FROM '만 (\d+) 세') AS INTEGER) BETWEEN 20 AND 29 THEN '20대'
        WHEN CAST(SUBSTRING(age_text FROM '만 (\d+) 세') AS INTEGER) BETWEEN 30 AND 39 THEN '30대'
        ...
    END AS age_group,
    COUNT(*) AS count
FROM core.doc_embedding_view
WHERE doc_id IN (...)
GROUP BY age_group
ORDER BY count DESC;
```

---

##### structured 타입

```python
if query_type == 'structured':
    sql_query = sql_result.get('sql', '')
    search_results = execute_sql_safe(query=sql_query, params={}, limit=10000)
    return jsonify({'type': 'structured', 'results': search_results, ...})
```

**특징**:
- 의미 검색 없음
- WHERE 조건만 적용
- 요약 없이 결과만 반환

---

##### hybrid 타입

```python
if query_type == 'hybrid':
    search_text = sql_result.get('search_text', question)
    sql_query = sql_result.get('sql', '')
    filters = sql_result.get('filters', {})
    
    # 벡터 검색 실행
    search_results = vector_service.execute_semantic_search_sql(
        sql_query=sql_query,
        embedding_input=search_text,
        limit=search_limit,
        distance_threshold=distance_threshold
    )
    
    # 구조적 필터만 적용한 전체 개수 계산
    total_count = calculate_total_count_with_filters(filters)
    
    # 결과 요약
    summary = generate_summary_with_llm(question, filters, search_results)
```

**SQL 예시**:
```sql
SELECT 
    v.doc_id,
    v.embedding_text AS content,
    v.gender,
    v.age_text,
    v.region,
    e.embedding <=> '<VECTOR>'::vector AS distance
FROM core.doc_embedding_view v
JOIN core.doc_embedding e ON v.doc_id = e.doc_id
WHERE v.gender = 'M' 
  AND (v.age_text LIKE '%만 30%' OR ...)
ORDER BY distance
LIMIT 10;
```

---

##### semantic 타입

```python
# 의미 검색 쿼리인 경우
search_text = sql_result.get('search_text', question)
sql_query = sql_result.get('sql', '')

# 임베딩 생성 및 SQL 실행
search_results = vector_service.execute_semantic_search_sql(
    sql_query=sql_query,
    embedding_input=search_text,
    limit=search_limit,
    distance_threshold=distance_threshold
)

# 결과 요약
summary = generate_summary_with_llm(question, search_results)
```

**SQL 예시**:
```sql
SELECT 
    v.doc_id,
    v.embedding_text AS content,
    v.gender,
    v.age_text,
    v.region,
    e.embedding <=> '<VECTOR>'::vector AS distance
FROM core.doc_embedding_view v
JOIN core.doc_embedding e ON v.doc_id = e.doc_id
ORDER BY distance
LIMIT 10;
```

---

#### 4단계: 결과 요약

```python
summary_prompt = f"""다음은 데이터베이스 의미 검색 결과입니다:

질문: {question}

검색 결과:
{str(search_results)[:2000]}

위 검색 결과를 바탕으로 사용자의 질문에 대한 답변을 자연스러운 한국어로 요약해주세요."""

summary_response = llm_service.client.messages.create(
    model=model or llm_service.get_default_model(),
    max_tokens=512,
    temperature=0,
    messages=[{"role": "user", "content": summary_prompt}]
)
summary = extract_text_from_response(summary_response)
```

---

## 쿼리 타입별 처리

### 1. Structured 쿼리

**예시**: "서울 20대 남자 100명"

**처리**:
```
1. classify_and_extract_query()
   → type: "structured"
   → filters: {gender: "M", age_range: "20s", region: "서울"}
   → limit: 100

2. generate_semantic_search_sql()
   → SQL 생성 (의미 검색 없음)
   → core.doc_embedding_view만 사용

3. SQL 실행
   → WHERE 조건만 적용
   → LIMIT 100

4. 결과 반환
   → 요약 없이 결과만 반환
```

---

### 2. Semantic 쿼리

**예시**: "운동 좋아하는 사람"

**처리**:
```
1. classify_and_extract_query()
   → type: "semantic"
   → search_text: "운동을 좋아하는 사람들"
   → filters: null

2. generate_semantic_search_sql()
   → SQL 생성 (벡터 검색 포함)
   → <VECTOR> 플레이스홀더 포함

3. execute_semantic_search_sql()
   → search_text를 임베딩 벡터로 변환
   → <VECTOR>를 실제 벡터로 교체
   → SQL 실행 (ORDER BY distance)

4. 결과 요약
   → LLM이 검색 결과를 요약
```

---

### 3. Hybrid 쿼리

**예시**: "운동 좋아하는 30대 남자 100명"

**처리**:
```
1. classify_and_extract_query()
   → type: "hybrid"
   → search_text: "운동을 좋아하는 사람들"
   → filters: {gender: "M", age_range: "30s"}
   → limit: 100

2. generate_semantic_search_sql()
   → SQL 생성 (WHERE 조건 + 벡터 검색)
   → WHERE v.gender = 'M' AND ... ORDER BY distance

3. execute_semantic_search_sql()
   → 벡터 검색 실행
   → 구조적 필터가 이미 WHERE 절에 포함됨

4. 전체 개수 계산
   → 구조적 필터만 적용한 COUNT 쿼리 실행

5. 결과 요약
   → LLM이 검색 결과와 필터를 함께 고려하여 요약
```

---

### 4. Analytical 쿼리

**예시**: "할인이나 포인트 멤버쉽 적립을 많이 애용하는 연령대는?"

**처리**:
```
1. classify_and_extract_query()
   → type: "analytical"
   → search_text: "할인 포인트 멤버쉽 적립을 많이 애용하는 사람들"
   → group_by: "age_range"
   → analysis_type: "most_frequent"

2. handle_analytical_query()
   a. 의미 기반 검색
      → 벡터 검색으로 관련 패널 1000개 찾기
      → distance_threshold = 0.7 적용
   
   b. 집계 쿼리 생성
      → 검색된 doc_id로 GROUP BY age_range
      → COUNT(*) 계산
   
   c. 결과 요약
      → "30대가 450명(45%)로 가장 많습니다"
```

**집계 쿼리 예시**:
```sql
SELECT 
    CASE 
        WHEN CAST(SUBSTRING(age_text FROM '만 (\d+) 세') AS INTEGER) BETWEEN 20 AND 29 THEN '20대'
        WHEN CAST(SUBSTRING(age_text FROM '만 (\d+) 세') AS INTEGER) BETWEEN 30 AND 39 THEN '30대'
        ...
    END AS age_group,
    COUNT(*) AS count
FROM core.doc_embedding_view
WHERE doc_id IN (검색된 doc_id 목록)
GROUP BY age_group
ORDER BY count DESC;
```

---

## 임베딩 및 벡터 검색

### 임베딩 모델

**모델**: `nlpai-lab/KURE-v1`
- **차원**: 1024
- **특징**: 한국어 특화 임베딩 모델
- **용도**: 의미 기반 검색

### 임베딩 생성 과정

```python
# 1. 텍스트 입력
query_text = "운동을 좋아하는 사람들"

# 2. 임베딩 모델로 벡터 변환
embedding = model.encode(query_text.strip()).tolist()
# 결과: [0.123, -0.456, 0.789, ..., 0.234] (1024차원)

# 3. PostgreSQL vector 타입 문자열로 변환
vector_str = '[' + ','.join(str(v) for v in embedding) + ']'
# 결과: "[0.123, -0.456, 0.789, ..., 0.234]"
```

### 벡터 검색 (pgvector)

**연산자**: `<=>` (코사인 거리)

**SQL 예시**:
```sql
SELECT 
    v.doc_id,
    v.embedding_text,
    e.embedding <=> '[0.123, -0.456, ...]'::vector AS distance
FROM core.doc_embedding_view v
JOIN core.doc_embedding e ON v.doc_id = e.doc_id
ORDER BY distance
LIMIT 10;
```

**거리 의미**:
- `distance = 0`: 완전히 유사
- `distance = 1`: 완전히 다름
- 일반적으로 `distance < 0.5`면 유사하다고 봄

### 유사도 임계값

```python
# COUNT 쿼리인 경우 유사도 임계값 적용
distance_threshold = 0.5 if is_count_query else None

# SQL에 WHERE 조건 추가
if distance_threshold:
    WHERE e.embedding <=> '<VECTOR>'::vector < 0.5
```

---

## 성능 최적화

### 1. 인덱스

**HNSW 인덱스** (벡터 검색):
```sql
CREATE INDEX idx_doc_embedding_hnsw 
ON core.doc_embedding 
USING hnsw (embedding vector_cosine_ops);
```

**doc_id 인덱스** (JOIN 최적화):
```sql
CREATE INDEX IF NOT EXISTS idx_doc_embedding_doc_id 
ON core.doc_embedding(doc_id);

CREATE INDEX IF NOT EXISTS idx_doc_embedding_view_doc_id 
ON core.doc_embedding_view(doc_id);
```

### 2. 쿼리 최적화

- **LIMIT 적용**: 불필요한 데이터 조회 방지
- **유사도 임계값**: 관련성 낮은 결과 필터링
- **인덱스 사용 강제**: 실행 계획 확인 및 인덱스 사용 권장

### 3. 실행 계획 확인

```python
explain_sql = "EXPLAIN " + final_sql
cur.execute(explain_sql)
explain_result = cur.fetchall()

# 인덱스 사용 여부 확인
if "Index Scan" in explain_text:
    print("[INFO] 인덱스 스캔 사용 중")
elif "Seq Scan" in explain_text:
    print("[WARN] Sequential Scan 사용 중 - 인덱스가 활용되지 않고 있습니다!")
```

---

## 에러 처리

### 주요 에러 타입

1. **임베딩 모델 로딩 실패**
   - 원인: sentence-transformers 미설치 또는 모델 다운로드 실패
   - 처리: RuntimeError 발생

2. **차원 불일치**
   - 원인: DB 임베딩 차원과 로컬 모델 차원이 다름
   - 처리: 경고 메시지 출력

3. **SQL 실행 실패**
   - 원인: 잘못된 SQL 또는 DB 연결 오류
   - 처리: 에러 메시지와 함께 500 응답

4. **쿼리 파싱 실패**
   - 원인: LLM이 JSON을 올바르게 생성하지 못함
   - 처리: error 타입 반환

---

## 로깅 및 디버깅

### 주요 로그 포인트

```python
# 쿼리 분류 결과
print(f"[DEBUG] Query Classification 결과: type={result.get('type')}, limit={result.get('limit')}")

# SQL 생성
print(f"[DEBUG] 생성된 SQL: {sql_query[:200]}...")
print(f"[DEBUG] 검색 텍스트: {search_text}")

# 검색 결과
print(f"[DEBUG] 검색 결과 개수: {len(search_results) if search_results else 0}")

# 집계 결과 (analytical)
print(f"[DEBUG] 집계 결과: {distribution_results}")

# 성능 경고
if execution_time > 1.0:
    print(f"[WARN] 느린 쿼리 감지: {execution_time:.2f}초")
```

---

## 결론

Panel Doctor 프로젝트는 다음과 같은 특징을 가집니다:

1. **다양한 검색 모드 지원**: 구조화된 검색, 의미 검색, 하이브리드 검색, 분석 질문
2. **LLM 기반 쿼리 이해**: 자연어 질의를 자동으로 분류하고 정보 추출
3. **벡터 검색 통합**: KURE v1 임베딩을 사용한 의미 기반 검색
4. **성능 최적화**: HNSW 인덱스, 쿼리 최적화, 실행 계획 확인
5. **유연한 확장성**: 새로운 쿼리 타입 추가 용이

이 문서는 프로젝트의 전체 로직을 이해하는 데 도움이 되도록 작성되었습니다.

