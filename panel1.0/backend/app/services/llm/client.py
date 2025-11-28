"""Claude LLM 툴콜 연동 서비스"""
from typing import Any, Dict, List
from datetime import date, datetime
from decimal import Decimal
import os
from anthropic import Anthropic
from app.services.data.executor import execute_sql_safe
from app.services.common.singleton import Singleton
from app.services.llm.prompts import SQL_TOOL_SYSTEM_HINT_TEMPLATE, QUERY_CLASSIFICATION_PROMPT, SQL_GENERATION_PROMPT


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


class LlmService(Singleton):
    """Singleton LlmService - 서버 시작 시 1회만 초기화"""
    
    _initialized = False
    
    def __init__(self) -> None:
        if LlmService._initialized:
            return
        
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY 환경변수가 필요합니다.")
        
        # ✅ Anthropic 클라이언트 초기화 (proxies 관련 에러 방지를 위해 명시적 파라미터만 사용)
        try:
            # 최신 anthropic 라이브러리는 api_key만 필요
            self.client = Anthropic(api_key=api_key)
        except TypeError as e:
            # proxies 관련 에러가 발생하면 api_key만 전달
            if "proxies" in str(e):
                print(f"[WARN] Anthropic 클라이언트 초기화 시 proxies 에러 발생, 재시도...")
                # 환경 변수에서 proxies 관련 설정 제거 후 재시도
                import anthropic
                # 최신 버전에서는 api_key만 필요
                self.client = Anthropic(api_key=api_key)
            else:
                raise
        
        env_model = os.environ.get("ANTHROPIC_MODEL")
        self._default_model = env_model if env_model else "claude-sonnet-4-5"
        print(f"[INFO] [SINGLETON] LlmService 초기화: 사용 중인 Claude 모델 = {self._default_model}")
        
        LlmService._initialized = True

    def get_default_model(self) -> str:
        return self._default_model
    
    def _get_db_schema_info(self) -> str:
        """실제 DB 스키마 정보를 문자열로 반환"""
        try:
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
                
                col_list = []
                for col in cols:
                    col_name = col['column_name']
                    col_type = col['data_type']
                    nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                    col_list.append(f"{col_name} ({col_type}, {nullable})")
                
                full_table_name = f'"{schema_name}"."{tbl_name}"'
                schema_info_parts.append(
                    f"- {full_table_name}:\n  컬럼: {', '.join(col_list[:10])}"
                )
            
            return "\n".join(schema_info_parts)
        except Exception as e:
            return f"스키마 정보 조회 실패: {str(e)}"

    def ask_with_tools(self, user_prompt: str, model: str | None = None) -> Dict[str, Any]:
        if not model:
            model = self.get_default_model()
        
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
        
        db_schema = self._get_db_schema_info()
        
        panel_result_context = ""
        if panel_search_result:
            estimated_count = panel_search_result.get('estimatedCount', 0)
            distribution_stats = panel_search_result.get('distributionStats', {})
            extracted_chips = panel_search_result.get('extractedChips', [])
            previous_panel_ids = panel_search_result.get('previousPanelIds', [])
            
            panel_result_context = "\n\n=== 패널 검색 결과 (이 데이터를 기반으로 답변하세요) ===\n"
            
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
        
        system_hint = SQL_TOOL_SYSTEM_HINT_TEMPLATE.format(
            db_schema=db_schema,
            panel_result_context=panel_result_context
        )

        messages = []
        if conversation_history:
            for msg in conversation_history:
                if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                    messages.append({
                        "role": msg['role'],
                        "content": str(msg['content'])
                    })
        
        messages.append({"role": "user", "content": user_prompt})

        if panel_search_result:
            try:
                direct_response = self.client.messages.create(
                    model=model,
                    max_tokens=1024,
                    temperature=0,
                    system=system_hint,
                    messages=messages,
                )
                text = "\n".join(getattr(c, "text", "") for c in direct_response.content if getattr(c, "type", None) == "text")
                
                # Parse response for widgets
                parsed_response = self._parse_storytelling_response(text)
                
                return {
                    "answer": parsed_response["answer"],
                    "widgets": parsed_response["widgets"],
                    "tool_called": False
                }
            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()
                print(f"[ERROR] LLM API 호출 실패 (panel_search_result 모드): {e}")
                print(f"[ERROR] 상세:\n{error_trace}")
                # 에러 발생 시 기본 응답 반환
                return {
                    "answer": "AI 분석을 불러오는 중 오류가 발생했습니다.",
                    "widgets": [],
                    "tool_called": False,
                    "error": str(e)
                }

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

        import json as json_lib
        tool_result_content = json_lib.dumps(tool_result_payload, ensure_ascii=False, default=str)

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
        
        # Parse response for widgets
        parsed_response = self._parse_storytelling_response(final_text)
        
        return {
            "answer": parsed_response["answer"],
            "widgets": parsed_response["widgets"],
            "tool_called": True,
            **tool_result_payload
        }

    def _parse_storytelling_response(self, text: str) -> Dict[str, Any]:
        """Parse LLM response to extract widgets"""
        import re
        import json
        
        widgets = []
        answer = text
        
        if not text:
            return {"answer": "", "widgets": []}
        
        # Extract JSON from the end of the response (widgets)
        # Try multiple patterns
        json_match = None
        
        # Pattern 1: ```json ... ```
        json_match = re.search(r'```json\s*(\{[\s\S]*?\})\s*```', text, re.DOTALL)
        
        if not json_match:
            # Pattern 2: ``` ... ``` (without json tag)
            json_match = re.search(r'```\s*(\{[\s\S]*?\})\s*```', text, re.DOTALL)
        
        if not json_match:
            # Pattern 3: Standalone JSON object (widgets)
            json_match = re.search(r'(\{\s*"widgets"[\s\S]*?\})', text, re.DOTALL)
        
        if json_match:
            try:
                json_str = json_match.group(1)
                parsed_json = json.loads(json_str)
                
                # Extract widgets if present
                if "widgets" in parsed_json:
                    widgets = parsed_json.get("widgets", [])
                
                # Remove JSON from answer text
                answer = text[:json_match.start()].strip()
            except Exception as e:
                print(f"[WARN] JSON 파싱 실패: {e}")
                print(f"[WARN] JSON 문자열: {json_match.group(1)[:200] if json_match else 'None'}")
        
        return {
            "answer": answer,
            "widgets": widgets
        }
    
    def list_models(self) -> Dict[str, Any]:
        models = self.client.models.list()
        names = [m.id for m in getattr(models, 'data', [])]
        return {"models": names}
    
    def classify_and_extract_query(self, user_query: str, model: str | None = None) -> Dict[str, Any]:
        """
        자연어 질의를 분류하고 정보를 추출합니다.
        """
        if not model:
            model = self.get_default_model()
        
        try:
            response = self.client.messages.create(
                model=model,
                max_tokens=1024,
                temperature=0,
                system=QUERY_CLASSIFICATION_PROMPT,
                messages=[
                    {"role": "user", "content": user_query}
                ],
            )
            
            text = "\n".join(getattr(c, "text", "") for c in response.content if getattr(c, "type", None) == "text")
            
            print(f"[DEBUG] Query Classification 원본 응답: {text[:500]}...")
            
            import json
            import re
            try:
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    parts = text.split("```")
                    if len(parts) >= 3:
                        text = parts[1].strip()
                        if text.startswith("json"):
                            text = text[4:].strip()
                
                json_start = text.find('{')
                if json_start == -1:
                    raise ValueError("JSON 객체를 찾을 수 없습니다.")
                
                brace_count = 0
                json_end = json_start
                for i in range(json_start, len(text)):
                    if text[i] == '{':
                        brace_count += 1
                    elif text[i] == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            json_end = i + 1
                            break
                
                json_str = text[json_start:json_end]
                result = json.loads(json_str)
                
                if 'type' not in result:
                    raise ValueError("결과에 'type' 필드가 없습니다.")
                
                query_type = result.get('type')
                if query_type == 'error':
                    if 'message' not in result:
                        result['message'] = "해석할 수 없는 질의입니다."
                elif query_type == 'analytical':
                    if 'search_text' not in result:
                        result['search_text'] = None
                    if 'group_by' not in result:
                        result['group_by'] = None
                    if 'analysis_type' not in result:
                        result['analysis_type'] = 'distribution'
                elif query_type in ['structured', 'hybrid']:
                    if 'filters' not in result:
                        result['filters'] = None
                elif query_type == 'semantic':
                    if 'filters' not in result:
                        result['filters'] = None
                    if 'search_text' not in result or not result['search_text']:
                        raise ValueError("semantic 타입은 'search_text'가 필수입니다.")
                
                print(f"[DEBUG] Query Classification 결과: type={result.get('type')}, limit={result.get('limit')}")
                return result
                
            except (json.JSONDecodeError, ValueError) as e:
                print(f"[ERROR] JSON 파싱 실패: {e}")
                return {
                    "type": "error",
                    "message": f"질의 파싱 실패: {str(e)}",
                    "filters": None,
                    "limit": None,
                    "search_text": None
                }
                
        except Exception as e:
            print(f"[ERROR] Query Classification 실패: {e}")
            import traceback
            traceback.print_exc()
            return {
                "type": "error",
                "message": f"질의 분류 중 오류 발생: {str(e)}",
                "filters": None,
                "limit": None,
                "search_text": None
            }

