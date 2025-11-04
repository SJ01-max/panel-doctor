"""Claude LLM 툴콜 연동 서비스"""
from typing import Any, Dict, List
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

    def ask_with_tools(self, user_prompt: str, model: str = "claude-3-5-sonnet-20241022") -> Dict[str, Any]:
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
            rows = execute_sql_safe(
                query=args.get("query", ""),
                params=args.get("params", {}),
                limit=int(args.get("limit", 200)),
                statement_timeout_ms=int(args.get("statement_timeout_ms", 5000)),
            )
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


