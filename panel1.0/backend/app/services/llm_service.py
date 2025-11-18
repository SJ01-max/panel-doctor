"""Claude LLM 툴콜 연동 서비스"""
from typing import Any, Dict, List
from datetime import date, datetime
from decimal import Decimal
import os
from anthropic import Anthropic
from app.services.sql_service import execute_sql_safe


SQL_TOOL = {
    "name": "execute_sql",
    "description": "안전한 읽기 전용 SQL을 실행합니다. SELECT/WITH만 허용됩니다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "SELECT 또는 WITH로 시작하는 쿼리"},
            "params": {"type": "object", "description": "바인딩 파라미터 (명명된 바인딩)"},
            "limit": {"type": "integer", "minimum": 1, "maximum": 1000, "default": 200},
            "statement_timeout_ms": {"type": "integer", "minimum": 100, "maximum": 20000, "default": 5000},
        },
        "required": ["query"],
    },
}


class LlmService:
    def __init__(self) -> None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY 환경변수가 필요합니다.")
        self.client = Anthropic(api_key=api_key)
        self._default_model = os.environ.get("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")

    def get_default_model(self) -> str:
        return self._default_model
    
    def _get_db_schema_info(self) -> str:
        """실제 DB 스키마 정보를 문자열로 반환 (LLM에게 제공)"""
        try:
            # 모든 스키마의 테이블 목록 조회
            tables = execute_sql_safe(
                query=(
                    "SELECT t.table_schema, t.table_name "
                    "FROM information_schema.tables t "
                    "WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast') "
                    "  AND t.table_type='BASE TABLE' "
                    "ORDER BY t.table_schema, t.table_name"
                ),
                limit=50,
            )
            
            schema_info_parts = []
            
            for tbl in tables:
                schema_name = tbl['table_schema']
                tbl_name = tbl['table_name']
                
                # 컬럼 정보 조회
                cols = execute_sql_safe(
                    query=(
                        "SELECT column_name, data_type, is_nullable "
                        "FROM information_schema.columns "
                        "WHERE table_schema=%(schema)s AND table_name=%(tbl)s "
                        "ORDER BY ordinal_position"
                    ),
                    params={"schema": schema_name, "tbl": tbl_name},
                    limit=200,
                )
                
                # 컬럼 목록 문자열 생성
                col_list = []
                for col in cols:
                    col_name = col['column_name']
                    col_type = col['data_type']
                    nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                    col_list.append(f"{col_name} ({col_type}, {nullable})")
                
                # 테이블 정보 문자열 생성
                full_table_name = f'"{schema_name}"."{tbl_name}"'
                schema_info_parts.append(
                    f"- {full_table_name}:\n  컬럼: {', '.join(col_list[:10])}"  # 최대 10개만 표시
                )
            
            return "\n".join(schema_info_parts)
        except Exception as e:
            return f"스키마 정보 조회 실패: {str(e)}"

    def ask_with_tools(self, user_prompt: str, model: str | None = None) -> Dict[str, Any]:
        if not model:
            model = self.get_default_model()
        """
        - 단일 턴에서 최대 1회의 툴콜을 처리 (데모용)
        - 모델이 execute_sql 툴을 호출하면 서버에서 실행 후 tool_result를 첨부하여 재호출
        """
        initial = self.client.messages.create(
            model=model,
            max_tokens=1024,
            temperature=0,
            tools=[SQL_TOOL],
            tool_choice={"type": "auto"},
            messages=[{"role": "user", "content": user_prompt}],
        )

        content = initial.content
        tool_use = next((c for c in content if getattr(c, "type", None) == "tool_use"), None)

        if not tool_use:
            # 툴콜 없이 바로 답변
            text = "\n".join(getattr(c, "text", "") for c in content if getattr(c, "type", None) == "text")
            return {"answer": text, "tool_called": False}

        if tool_use.name != "execute_sql":
            return {"answer": "지원되지 않는 툴 호출입니다.", "tool_called": True}

        args = tool_use.input or {}
        try:
            raw_rows = execute_sql_safe(
                query=args.get("query", ""),
                params=args.get("params", {}),
                limit=int(args.get("limit", 200)),
                statement_timeout_ms=int(args.get("statement_timeout_ms", 5000)),
            )
            # JSON 직렬화 안전 처리
            def _conv(v: Any) -> Any:
                if isinstance(v, (date, datetime)):
                    return v.isoformat()
                if isinstance(v, Decimal):
                    return float(v)
                return v
            rows: List[Dict[str, Any]] = [
                {k: _conv(v) for k, v in r.items()} for r in raw_rows
            ]
            tool_result_payload = {"rows": rows, "count": len(rows)}
        except Exception as e:
            tool_result_payload = {"error": str(e)}

        followup = self.client.messages.create(
            model=model,
            max_tokens=1024,
            temperature=0,
            tools=[SQL_TOOL],
            messages=[
                {"role": "user", "content": user_prompt},
                {
                    "role": "assistant",
                    "content": [
                        {"type": "tool_use", "id": tool_use.id, "name": "execute_sql", "input": args},
                    ],
                },
                {"role": "user", "content": [{"type": "tool_result", "tool_use_id": tool_use.id, "content": tool_result_payload}]},
            ],
        )

        final_text = "\n".join(getattr(c, "text", "") for c in followup.content if getattr(c, "type", None) == "text")
        return {"answer": final_text, "tool_called": True, "tool_result_preview": str(tool_result_payload)[:500]}

    def ask_for_sql_rows(self, user_prompt: str, model: str | None = None, conversation_history: List[Dict[str, Any]] | None = None, panel_search_result: Dict[str, Any] | None = None) -> Dict[str, Any]:
        if not model:
            model = self.get_default_model()
        """
        실제 DB 스키마 정보를 기반으로 SQL-툴콜을 유도하여 결과 rows/count를 반환.
        - SELECT/WITH만 허용됨을 명시
        - 실제 테이블 구조를 동적으로 가져와서 LLM에게 제공
        - 대화 히스토리를 지원하여 연속적인 대화 가능
        - 패널 검색 결과를 받아서 일관된 답변 생성
        """
        # 실제 DB 스키마 정보 가져오기
        db_schema = self._get_db_schema_info()
        
        # 패널 검색 결과가 있으면 이를 프롬프트에 포함
        panel_result_context = ""
        if panel_search_result:
            estimated_count = panel_search_result.get('estimatedCount', 0)
            distribution_stats = panel_search_result.get('distributionStats', {})
            extracted_chips = panel_search_result.get('extractedChips', [])
            previous_panel_ids = panel_search_result.get('previousPanelIds', [])
            
            panel_result_context = "\n\n=== 패널 검색 결과 (이 데이터를 기반으로 답변하세요) ===\n"
            
            # 이전 추출 결과를 기반으로 하는 질의인지 표시
            if previous_panel_ids and len(previous_panel_ids) > 0:
                panel_result_context += f"⚠️ 중요: 이 질의는 이전에 추출된 {len(previous_panel_ids):,}명의 패널을 기반으로 합니다.\n"
                panel_result_context += "이 패널들 중에서 추가 조건을 만족하는 패널을 찾아야 합니다.\n\n"
            
            panel_result_context += f"총 패널 수: {estimated_count:,}명\n"
            
            if extracted_chips:
                panel_result_context += f"추출된 조건: {', '.join(extracted_chips)}\n"
            
            if distribution_stats:
                gender_stats = distribution_stats.get('gender', [])
                age_stats = distribution_stats.get('age', [])
                region_stats = distribution_stats.get('region', [])
                
                if gender_stats:
                    panel_result_context += "\n성별 분포:\n"
                    for stat in gender_stats:
                        panel_result_context += f"  - {stat.get('label', 'N/A')}: {stat.get('value', 0):,}명\n"
                
                if age_stats:
                    panel_result_context += "\n연령대 분포:\n"
                    for stat in age_stats:
                        panel_result_context += f"  - {stat.get('label', 'N/A')}: {stat.get('value', 0):,}명\n"
                
                if region_stats:
                    panel_result_context += "\n지역 분포 (상위 10개):\n"
                    for stat in region_stats[:10]:
                        panel_result_context += f"  - {stat.get('label', 'N/A')}: {stat.get('value', 0):,}명\n"
            
            panel_result_context += "\n중요: 위 패널 검색 결과의 총 패널 수와 분포 통계를 정확히 사용하여 답변하세요. SQL을 실행하지 말고 제공된 데이터를 기반으로 분석 결과를 설명하세요.\n"
        
        system_hint = (
            "당신은 데이터 분석 보조입니다. 사용자 요청을 읽고, 반드시 SELECT 또는 WITH로 시작하는 "
            "하나의 읽기 전용 SQL만 사용하세요. SQL 쿼리에는 세미콜론(;)을 포함하지 마세요.\n\n"
            "=== 데이터베이스 스키마 정보 ===\n"
            f"{db_schema}\n\n"
            "=== 중요 사항 ===\n"
            "1. 테이블명은 스키마를 포함하여 \"스키마명\".\"테이블명\" 형식으로 사용하세요.\n"
            "2. SQL 쿼리에는 절대 세미콜론(;)을 포함하지 마세요. 단일 SELECT 문만 작성하세요.\n"
            "3. 패널 검색 결과가 제공된 경우, SQL을 실행하지 말고 제공된 데이터를 기반으로 분석 결과를 설명하세요.\n"
            "4. core.join_clean 테이블: 패널 기본 정보\n"
            "   - gender: '남'/'여'\n"
            "   - region: 지역명 (예: '서울', '부산')\n"
            "   - age_text: '1987년 06월 29일 (만 38 세)' 형식\n"
            "   - respondent_id: 패널 ID\n"
            "   - q_concat: 질문 답변 번호 (숫자)\n"
            "5. core.docs_json 테이블: 상세 답변 데이터 (JSONB)\n"
            "   - doc: jsonb 타입, 구조: {answers: {...}, gender, region, age_text, ...}\n"
            "6. core.poll_question 테이블: 질문 텍스트\n"
            "   - question_text: 질문 내용\n"
            "   - poll_code: 설문 코드\n"
            "   - q_no: 질문 번호\n"
            "7. core.poll_option 테이블: 답변 옵션 텍스트\n"
            "   - opt_text: 답변 옵션 텍스트 (예: '넷플릭스', '디즈니 플러스', '유튜브', '운동', '달리기' 등)\n"
            "   - poll_code: 설문 코드\n"
            "   - q_no: 질문 번호\n"
            "   - opt_no: 옵션 번호\n"
            "8. core.poll_option_count 테이블: 옵션별 응답 수\n"
            "9. 의미 기반 검색 방법 (예: '달리는 걸 좋아하는'):\n"
            "   단계 1: poll_option에서 관련 키워드가 포함된 옵션 찾기\n"
            "     SELECT opt_no, q_no, poll_code FROM \"core\".\"poll_option\"\n"
            "     WHERE opt_text LIKE '%달리%' OR opt_text LIKE '%러닝%' OR opt_text LIKE '%조깅%' OR opt_text LIKE '%운동%'\n"
            "   단계 2: join_clean의 q_concat에서 해당 옵션 번호가 포함된 사람 찾기\n"
            "     SELECT * FROM \"core\".\"join_clean\"\n"
            "     WHERE region LIKE '%서울%'\n"
            "       AND gender = '남'\n"
            "       AND CAST(SUBSTRING(age_text FROM '만 (\\d+) 세') AS INTEGER) BETWEEN 30 AND 39\n"
            "       AND q_concat LIKE '%2%'  -- 예: opt_no=2인 경우\n"
            "   또는 JOIN 사용:\n"
            "     SELECT DISTINCT jc.respondent_id\n"
            "     FROM \"core\".\"join_clean\" jc\n"
            "     JOIN \"core\".\"poll_option\" po ON jc.q_concat LIKE '%' || po.opt_no::text || '%'\n"
            "     WHERE jc.region LIKE '%서울%'\n"
            "       AND jc.gender = '남'\n"
            "       AND CAST(SUBSTRING(jc.age_text FROM '만 (\\d+) 세') AS INTEGER) BETWEEN 30 AND 39\n"
            "       AND (po.opt_text LIKE '%달리%' OR po.opt_text LIKE '%러닝%' OR po.opt_text LIKE '%조깅%' OR po.opt_text LIKE '%운동%')\n"
            "   LIMIT 100\n"
            "10. 성별은 '남'/'여' 값을 사용합니다.\n"
            "11. 연령대 필터링:\n"
            "   - age_text 컬럼: CAST(SUBSTRING(age_text FROM '만 (\\d+) 세') AS INTEGER) BETWEEN 20 AND 29\n"
            "   - birthdate 컬럼: (EXTRACT(YEAR FROM CURRENT_DATE)-EXTRACT(YEAR FROM birthdate)) BETWEEN 20 AND 29\n"
            "12. 지역 필터링: region LIKE '%서울%' 형식 사용\n"
            "13. JOIN 예시: core.join_clean과 core.docs_json을 respondent_id로 조인하여 필터링\n"
            "14. 패널 검색 결과가 제공되면 SQL을 실행하지 말고, 제공된 데이터를 기반으로 분석 결과를 설명하세요.\n"
            "15. 질문에 직접 답하지 말고, 필요 시 툴콜 후 결과를 요약하세요.\n"
            "16. 이전 대화 맥락을 고려하여 사용자의 연속적인 질문에 자연스럽게 답변하세요."
            f"{panel_result_context}"
        )

        # 대화 히스토리 구성
        messages = []
        if conversation_history:
            # 대화 히스토리를 Claude API 형식으로 변환
            for msg in conversation_history:
                if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                    messages.append({
                        "role": msg['role'],
                        "content": str(msg['content'])
                    })
        
        # 현재 사용자 질의 추가
        messages.append({"role": "user", "content": user_prompt})

        # 패널 검색 결과가 있으면 SQL 실행 없이 바로 답변 생성
        if panel_search_result:
            # 패널 검색 결과가 제공된 경우, SQL을 실행하지 않고 직접 답변 생성
            direct_response = self.client.messages.create(
                model=model,
                max_tokens=1024,
                temperature=0,
                system=system_hint,
                messages=messages,
            )
            text = "\n".join(getattr(c, "text", "") for c in direct_response.content if getattr(c, "type", None) == "text")
            return {"answer": text, "tool_called": False}

        initial = self.client.messages.create(
            model=model,
            max_tokens=1024,
            temperature=0,
            tools=[SQL_TOOL],
            tool_choice={"type": "auto"},
            system=system_hint,
            messages=messages,
        )

        content = initial.content
        tool_use = next((c for c in content if getattr(c, "type", None) == "tool_use"), None)
        if not tool_use:
            text = "\n".join(getattr(c, "text", "") for c in content if getattr(c, "type", None) == "text")
            return {"answer": text, "tool_called": False}

        args = tool_use.input or {}
        try:
            rows = execute_sql_safe(
                query=args.get("query", ""),
                params=args.get("params", {}),
                limit=int(args.get("limit", 200)),
                statement_timeout_ms=int(args.get("statement_timeout_ms", 5000)),
            )
            # JSON 직렬화 안전 처리
            def _conv(v: Any) -> Any:
                if isinstance(v, (date, datetime)):
                    return v.isoformat()
                if isinstance(v, Decimal):
                    return float(v)
                return v
            rows_clean: List[Dict[str, Any]] = [
                {k: _conv(v) for k, v in r.items()} for r in rows
            ]
            tool_result_payload = {"rows": rows_clean, "count": len(rows_clean)}
        except Exception as e:
            tool_result_payload = {"error": str(e)}

        # tool_result의 content는 문자열이어야 함 (JSON 문자열로 변환)
        import json as json_lib
        tool_result_content = json_lib.dumps(tool_result_payload, ensure_ascii=False, default=str)

        # followup 메시지에도 대화 히스토리 포함
        followup_messages = []
        if conversation_history:
            for msg in conversation_history:
                if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                    followup_messages.append({
                        "role": msg['role'],
                        "content": str(msg['content'])
                    })
        
        followup_messages.extend([
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": [{"type": "tool_use", "id": tool_use.id, "name": "execute_sql", "input": args}]},
            {"role": "user", "content": [{"type": "tool_result", "tool_use_id": tool_use.id, "content": tool_result_content}]},
        ])

        followup = self.client.messages.create(
            model=model,
            max_tokens=1024,
            temperature=0,
            tools=[SQL_TOOL],
            system=system_hint,
            messages=followup_messages,
        )

        final_text = "\n".join(getattr(c, "text", "") for c in followup.content if getattr(c, "type", None) == "text")
        return {"answer": final_text, "tool_called": True, **tool_result_payload}

    def list_models(self) -> Dict[str, Any]:
        models = self.client.models.list()
        names = [m.id for m in getattr(models, 'data', [])]
        return {"models": names}
    
    def generate_semantic_search_sql(self, user_question: str, model: str | None = None) -> Dict[str, Any]:
        """
        사용자 질문을 받아서 semantic search를 위한 SQL 쿼리를 생성합니다.
        
        Returns:
            {
                "search_text": "벡터화할 검색 문구",
                "sql": "SELECT ... WHERE embedding <=> '<VECTOR>'::vector ..."
            }
        """
        if not model:
            model = self.get_default_model()
        
        system_prompt = """You are the AI reasoning and SQL generation engine for a hybrid search system
that supports two modes:

1) Panel Search Mode (Structured SQL Filtering)
2) Semantic Search Mode (Embedding-based Vector Search)

────────────────────────────────────────────
📌 DATABASE FACTS  (반드시 지켜야 함)
────────────────────────────────────────────
- All document vectors (1024-dimension, KURE v1) are stored in:
      core.doc_embedding (columns: doc_id, embedding, model_name, created_at)

- The actual text used for embedding is stored in:
      core.doc_embedding_view.embedding_text

- To perform semantic search, you MUST always JOIN:
      core.doc_embedding_view AS v
      core.doc_embedding      AS e
  using v.doc_id = e.doc_id

- Do NOT apply similarity thresholds. Use ORDER BY distance LIMIT 10.

- Backend replaces <VECTOR> with the 1024-dim vector generated by KURE v1.
  NEVER generate embeddings yourself.

Table schema:
    core.doc_embedding(
        doc_id BIGINT,
        embedding VECTOR(1024),
        model_name TEXT,
        created_at TIMESTAMP
    )
    
    core.doc_embedding_view(
        doc_id BIGINT,
        embedding_text TEXT,
        gender TEXT,
        age_text TEXT,
        region TEXT,
        poll_code TEXT,
        respondent_id TEXT,
        survey_datetime TIMESTAMP,
        doc_type TEXT
    )

────────────────────────────────────────────
📌 CLASSIFICATION RULE (모드 자동 분기)
────────────────────────────────────────────
Given a user query, classify whether it is:

A) structured panel filtering
   → 성별, 연령대, 지역, 응답 시점 등 명확한 조건 기반 검색
   → 예:  "20대 여자", "서울 사는 남자", "30대 남성 응답자"

B) semantic embedding search
   → 의미 기반 텍스트가 포함된 검색
   → 예:  "운동 좋아하는 사람", "감정적으로 불안한 20대", 
           "취향이 비슷한 응답자", "스트레스 많은 층"

C) hybrid search (structured + semantic)
   → 의미 기반 + 구조적 필터 결합
   → 예: "운동 좋아하는 30대 남자"

You must classify the user query into one of:
  "structured", "semantic", "hybrid"

────────────────────────────────────────────
📌 OUTPUT FORMAT
────────────────────────────────────────────
ALWAYS RETURN JSON ONLY.

(1) Structured Query (패널 검색 모드):

{
  "type": "structured",
  "filters": { ... }, 
  "sql": "SELECT ... FROM core.doc_embedding_view ... WHERE ..."
}

(2) Semantic Query (의미 검색 모드):

{
  "type": "semantic",
  "search_text": "TEXT_TO_EMBED",
  "sql": "SELECT ... JOIN ... ORDER BY distance LIMIT 10"
}

(3) Hybrid Query (구조적 + 의미 검색):

{
  "type": "hybrid",
  "search_text": "TEXT_TO_EMBED",
  "filters": { ... },
  "sql": "SELECT ... JOIN ... WHERE ... ORDER BY distance LIMIT 10"
}

────────────────────────────────────────────
📌 SEMANTIC SEARCH SQL TEMPLATE (필수)
────────────────────────────────────────────

SELECT 
    v.doc_id,
    v.embedding_text AS content,
    v.gender,
    v.age_text,
    v.region,
    e.embedding <=> '<VECTOR>'::vector AS distance
FROM core.doc_embedding_view v
JOIN core.doc_embedding e ON v.doc_id = e.doc_id
{WHERE_CLAUSE_IF_NEEDED}
ORDER BY distance
LIMIT 10;

CRITICAL RULES (MUST FOLLOW):
1. ALWAYS use JOIN with v and e.
2. ALWAYS return ORDER BY distance LIMIT 10 (NO EXCEPTIONS!).
3. NEVER include <VECTOR> replacement. Backend will replace it.
4. LIMIT 10 is MANDATORY - NEVER omit it, NEVER use different values.
5. For hybrid queries, add WHERE filters BEFORE ORDER BY:
   - Example: WHERE v.gender = 'M' AND v.age_text LIKE '30%'
   - WHERE must come BEFORE ORDER BY, not after
6. NEVER add threshold filtering like:
   - "WHERE distance < 0.5"
   - "WHERE 1 - (embedding <=> ...) > 0.3"
   - "AND distance < X"
7. For semantic-only queries, use NO WHERE clause.
8. For hybrid queries, WHERE must contain ONLY structured filters (gender, age, region).

OUTPUT VALIDATION:
- Every semantic SQL MUST end with: "ORDER BY distance LIMIT 10"
- If LIMIT is missing, the query will FAIL.
- If threshold is added, the query will FAIL.

────────────────────────────────────────────
📌 FILTER EXTRACTION RULE (Structured/Hybrid)
────────────────────────────────────────────
If the question includes:
- 성별(남자/여자/남성/여성) → gender
- 연령대(10대,20대,30대…) → age_range
- 지역(서울/경기/부산/대구…) → region

Extract them into filters JSON:

"filters": {
   "gender": "M" or "F",
   "age": "20s" or "30s" etc,
   "region": "서울"
}

────────────────────────────────────────────
📌 BEHAVIOR SUMMARY
────────────────────────────────────────────
1. 이해 → Query classification
2. structured면 SQL WHERE 중심으로 생성
3. semantic이면 search_text + semantic SQL 생성 (LIMIT 10 필수!)
4. hybrid면 filters + search_text + semantic SQL 생성 (WHERE + LIMIT 10 필수!)
5. ALWAYS output JSON only.

CRITICAL REMINDERS:
- Semantic SQL MUST ALWAYS end with "ORDER BY distance LIMIT 10"
- NEVER add threshold filtering (distance < X, similarity > Y)
- Hybrid queries: WHERE filters BEFORE ORDER BY
- If LIMIT 10 is missing, the backend will FAIL

If a query makes no sense:
{
  "type": "error",
  "message": "해당 질의를 해석할 수 없습니다."
}
"""
        
        try:
            response = self.client.messages.create(
                model=model,
                max_tokens=1024,
                temperature=0,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_question}
                ],
            )
            
            # 응답에서 텍스트 추출
            text = "\n".join(getattr(c, "text", "") for c in response.content if getattr(c, "type", None) == "text")
            
            # JSON 파싱 시도
            import json
            import re
            try:
                # JSON 코드 블록 제거 시도
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()
                
                # JSON 객체만 추출 (첫 번째 { 부터 마지막 } 까지)
                # LLM이 JSON 뒤에 추가 설명을 붙이는 경우 대비
                json_match = re.search(r'\{.*\}', text, re.DOTALL)
                if json_match:
                    text = json_match.group(0)
                
                result = json.loads(text)
                
                # type 필드 확인
                query_type = result.get("type", "").lower()
                
                if query_type == "error":
                    return {
                        "error": result.get("reason", "Unknown error"),
                        "raw_response": text
                    }
                
                # structured 쿼리인 경우
                if query_type == "structured":
                    if "sql" not in result:
                        return {
                            "error": "LLM 응답에 sql이 없습니다.",
                            "raw_response": text
                        }
                    return {
                        "type": "structured",
                        "filters": result.get("filters", {}),
                        "sql": result["sql"]
                    }
                
                # semantic 쿼리인 경우
                if query_type == "semantic":
                    if "search_text" not in result or "sql" not in result:
                        return {
                            "error": "LLM 응답에 search_text 또는 sql이 없습니다.",
                            "raw_response": text
                        }
                    
                    # SQL에 <VECTOR> 플레이스홀더가 있는지 확인
                    if "<VECTOR>" not in result.get("sql", ""):
                        return {
                            "error": "SQL 쿼리에 <VECTOR> 플레이스홀더가 없습니다.",
                            "raw_response": text
                        }
                    
                    return {
                        "type": "semantic",
                        "search_text": result["search_text"],
                        "sql": result["sql"]
                    }
                
                # hybrid 쿼리인 경우
                if query_type == "hybrid":
                    if "search_text" not in result or "sql" not in result:
                        return {
                            "error": "LLM 응답에 search_text 또는 sql이 없습니다.",
                            "raw_response": text
                        }
                    
                    # SQL에 <VECTOR> 플레이스홀더가 있는지 확인
                    if "<VECTOR>" not in result.get("sql", ""):
                        return {
                            "error": "SQL 쿼리에 <VECTOR> 플레이스홀더가 없습니다.",
                            "raw_response": text
                        }
                    
                    return {
                        "type": "hybrid",
                        "search_text": result["search_text"],
                        "filters": result.get("filters", {}),
                        "sql": result["sql"]
                    }
                
                # type이 없으면 기존 형식으로 처리 (하위 호환성)
                if "search_text" in result and "sql" in result:
                    if "<VECTOR>" not in result.get("sql", ""):
                        return {
                            "error": "SQL 쿼리에 <VECTOR> 플레이스홀더가 없습니다.",
                            "raw_response": text
                        }
                    return {
                        "type": "semantic",
                        "search_text": result["search_text"],
                        "sql": result["sql"]
                    }
                
                return {
                    "error": "LLM 응답 형식이 올바르지 않습니다. type 필드가 필요합니다.",
                    "raw_response": text
                }
            except json.JSONDecodeError:
                return {
                    "error": "LLM 응답을 JSON으로 파싱할 수 없습니다.",
                    "raw_response": text
                }
        except Exception as e:
            return {
                "error": f"LLM 호출 실패: {str(e)}"
            }


