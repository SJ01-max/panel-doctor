# 백엔드 리팩토링 요약

## 완료된 작업

### 1. LLM Structured Output 파서 구현
- **파일**: `app/services/llm_structured_parser.py`
- LLM이 오직 JSON 구조만 생성하도록 변경
- `search_mode`는 항상 "auto"로 강제
- LLM은 검색 방식을 결정하지 않음

### 2. 자동 검색 전략 선택기 구현
- **파일**: `app/services/strategy_selector.py`
- 백엔드에서 filters와 semantic_keywords를 기반으로 자동 전략 선택
- 규칙:
  - `filter_only`: filters ≠ {} AND semantic_keywords = [] → filter_first
  - `semantic_only`: filters = {} AND semantic_keywords ≠ [] → semantic_first
  - `hybrid`: filters ≠ {} AND semantic_keywords ≠ [] → hybrid

### 3. 검색 모듈 구현
- **필터 우선 검색**: `app/services/search_filter_first.py`
- **의미 우선 검색**: `app/services/search_semantic_first.py`
- **하이브리드 검색**: `app/services/search_hybrid.py`

### 4. 안전 SQL Generator 구현
- **파일**: `app/services/sql_generator.py`
- psycopg2 파라미터 바인딩 사용
- SQL Injection 방지

### 5. 통합 검색 서비스 구현
- **파일**: `app/services/search_service.py`
- 자동 전략 선택 + Fallback 로직 포함
- Fallback 규칙:
  - semantic_first → 결과 X → hybrid 자동 재시도
  - filter_first → 결과 X → semantic_first 자동 재시도

### 6. 단일 검색 엔드포인트 통합
- **파일**: `app/routes/search.py`
- `/api/search` 하나로 통합
- 모든 자연어 질의를 자동으로 처리

### 7. 프론트엔드 통합
- **파일**: `frontend/src/api/search.ts`
- 통합 검색 API 함수 추가
- QueryCanvas에서 검색 모드 전환 버튼 제거
- 자동 검색 모드 사용

### 8. 테스트 코드 생성
- `tests/test_strategy_selector.py`
- `tests/test_llm_structured_parser.py`
- `tests/test_search_integration.py`

## 새로운 파일 구조

```
backend/
  ├── app/
  │   ├── routes/
  │   │   └── search.py (새로운 통합 검색 엔드포인트)
  │   ├── services/
  │   │   ├── llm_structured_parser.py (새로 추가)
  │   │   ├── strategy_selector.py (새로 추가)
  │   │   ├── sql_generator.py (새로 추가)
  │   │   ├── search_service.py (새로 추가)
  │   │   ├── search_filter_first.py (새로 추가)
  │   │   ├── search_semantic_first.py (새로 추가)
  │   │   └── search_hybrid.py (새로 추가)
  │   └── __init__.py (수정: 새 라우트 등록)
  └── tests/
      ├── test_strategy_selector.py (새로 추가)
      ├── test_llm_structured_parser.py (새로 추가)
      └── test_search_integration.py (새로 추가)
```

## API 변경사항

### 새로운 엔드포인트
- `POST /api/search` - 통합 검색 엔드포인트

### 요청 형식
```json
{
  "query": "서울 20대 남자 100명",
  "model": "claude-sonnet-4-5" (선택사항)
}
```

### 응답 형식
```json
{
  "results": [...],
  "count": 100,
  "strategy": "filter_first" | "semantic_first" | "hybrid",
  "parsed_query": {
    "filters": {...},
    "semantic_keywords": [...],
    "intent": "panel_search",
    "search_mode": "auto",
    "limit": 100
  },
  "selected_strategy": "filter_first",
  "strategy_info": {
    "name": "필터 우선 검색",
    "description": "...",
    "uses_sql": true,
    "uses_embedding": false
  },
  "has_results": true,
  "fallback_attempted": false
}
```

## 환경변수

- `SEMANTIC_DISTANCE_THRESHOLD`: 의미 검색 거리 임계값 (기본값: 0.65)
- `HYBRID_DISTANCE_THRESHOLD`: 하이브리드 검색 거리 임계값 (기본값: 0.65)
- `ANTHROPIC_MODEL`: 사용할 Claude 모델 (기본값: claude-sonnet-4-5)

## 기존 코드 처리

기존 파서 코드(`enhanced_query_parser.py`, `query_parser.py`)와 라우트(`/api/panel/search`, `/api/llm/semantic_search`)는 하위 호환성을 위해 유지되었습니다.

제거하려면:
1. `app/services/enhanced_query_parser.py` 삭제
2. `app/services/query_parser.py` 삭제
3. `app/routes/search_routes.py`에서 기존 검색 엔드포인트 제거
4. `app/routes/llm_routes.py`에서 semantic_search 엔드포인트 제거

## 다음 단계

1. 테스트 실행 및 검증
2. 기존 파서 코드 제거 (선택사항)
3. 프론트엔드 UI 추가 개선
4. 성능 최적화

