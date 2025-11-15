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

    def ask_for_sql_rows(self, user_prompt: str, model: str | None = None) -> Dict[str, Any]:
        if not model:
            model = self.get_default_model()
        """
        실제 DB 스키마 정보를 기반으로 SQL-툴콜을 유도하여 결과 rows/count를 반환.
        - SELECT/WITH만 허용됨을 명시
        - 실제 테이블 구조를 동적으로 가져와서 LLM에게 제공
        """
        # 실제 DB 스키마 정보 가져오기
        db_schema = self._get_db_schema_info()
        
        system_hint = (
            "당신은 데이터 분석 보조입니다. 사용자 요청을 읽고, 반드시 SELECT 또는 WITH로 시작하는 "
            "하나의 읽기 전용 SQL만 사용하세요.\n\n"
            "=== 데이터베이스 스키마 정보 ===\n"
            f"{db_schema}\n\n"
            "=== 중요 사항 ===\n"
            "1. 테이블명은 스키마를 포함하여 \"스키마명\".\"테이블명\" 형식으로 사용하세요.\n"
            "2. core.join_clean 테이블: 패널 기본 정보\n"
            "   - gender: '남'/'여'\n"
            "   - region: 지역명 (예: '서울', '부산')\n"
            "   - age_text: '1987년 06월 29일 (만 38 세)' 형식\n"
            "   - respondent_id: 패널 ID\n"
            "   - q_concat: 질문 답변 번호 (숫자)\n"
            "3. core.docs_json 테이블: 상세 답변 데이터 (JSONB)\n"
            "   - doc: jsonb 타입, 구조: {answers: {...}, gender, region, age_text, ...}\n"
            "4. core.poll_question 테이블: 질문 텍스트\n"
            "   - question_text: 질문 내용\n"
            "   - poll_code: 설문 코드\n"
            "   - q_no: 질문 번호\n"
            "5. core.poll_option 테이블: 답변 옵션 텍스트\n"
            "   - opt_text: 답변 옵션 텍스트 (예: '넷플릭스', '디즈니 플러스', '유튜브', '운동', '달리기' 등)\n"
            "   - poll_code: 설문 코드\n"
            "   - q_no: 질문 번호\n"
            "   - opt_no: 옵션 번호\n"
            "6. core.poll_option_count 테이블: 옵션별 응답 수\n"
            "7. 의미 기반 검색 방법 (예: '달리는 걸 좋아하는'):\n"
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
            "5. 성별은 '남'/'여' 값을 사용합니다.\n"
            "6. 연령대 필터링:\n"
            "   - age_text 컬럼: CAST(SUBSTRING(age_text FROM '만 (\\d+) 세') AS INTEGER) BETWEEN 20 AND 29\n"
            "   - birthdate 컬럼: (EXTRACT(YEAR FROM CURRENT_DATE)-EXTRACT(YEAR FROM birthdate)) BETWEEN 20 AND 29\n"
            "7. 지역 필터링: region LIKE '%서울%' 형식 사용\n"
            "8. JOIN 예시: core.join_clean과 core.docs_json을 respondent_id로 조인하여 필터링\n"
            "9. SQL이 필요하면 execute_sql 툴을 호출하세요.\n"
            "10. 질문에 직접 답하지 말고, 필요 시 툴콜 후 결과를 요약하세요."
        )

        initial = self.client.messages.create(
            model=model,
            max_tokens=1024,
            temperature=0,
            tools=[SQL_TOOL],
            tool_choice={"type": "auto"},
            system=system_hint,
            messages=[
                {"role": "user", "content": user_prompt},
            ],
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

        followup = self.client.messages.create(
            model=model,
            max_tokens=1024,
            temperature=0,
            tools=[SQL_TOOL],
            system=system_hint,
            messages=[
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": [{"type": "tool_use", "id": tool_use.id, "name": "execute_sql", "input": args}]},
                {"role": "user", "content": [{"type": "tool_result", "tool_use_id": tool_use.id, "content": tool_result_content}]},
            ],
        )

        final_text = "\n".join(getattr(c, "text", "") for c in followup.content if getattr(c, "type", None) == "text")
        return {"answer": final_text, "tool_called": True, **tool_result_payload}

    def list_models(self) -> Dict[str, Any]:
        models = self.client.models.list()
        names = [m.id for m in getattr(models, 'data', [])]
        return {"models": names}