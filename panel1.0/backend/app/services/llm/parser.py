"""
LLM Structured Output 파서
"""
from typing import Dict, Any, Optional
import json
from app.services.llm.client import LlmService
from app.services.llm.prompts import STRUCTURED_PARSER_PROMPT


class LlmStructuredParser:
    """
    LLM을 사용하여 자연어 질의를 구조화된 JSON으로 변환
    """
    
    def __init__(self):
        self.llm_service = LlmService()
    
    def parse(self, user_query: str, model: Optional[str] = None) -> Dict[str, Any]:
        """
        자연어 질의를 구조화된 JSON으로 파싱
        
        Args:
            user_query: 사용자 자연어 질의
            model: 사용할 LLM 모델
        
        Returns:
            {
                "filters": {...},
                "semantic_keywords": [...],
                "intent": "panel_search",
                "search_mode": "auto",
                "limit": 100 | null
            }
        """
        if not model:
            model = self.llm_service.get_parser_model()
        
        try:
            response = self.llm_service.client.messages.create(
                model=model,
                max_tokens=1024,
                temperature=0,
                system=STRUCTURED_PARSER_PROMPT,
                messages=[
                    {"role": "user", "content": user_query}
                ],
            )
            
            text = "\n".join(
                getattr(c, "text", "") 
                for c in response.content 
                if getattr(c, "type", None) == "text"
            )
            
            parsed = self._extract_json(text)
            parsed = self._validate_and_normalize(parsed)
            parsed["search_mode"] = "auto"
            
            return parsed
            
        except Exception as e:
            print(f"[ERROR] LLM 파싱 실패: {e}")
            import traceback
            traceback.print_exc()
            return {
                "filters": {},
                "semantic_keywords": [],
                "intent": "panel_search",
                "search_mode": "auto",
                "limit": None
            }
    
    def _extract_json(self, text: str) -> Dict[str, Any]:
        """텍스트에서 JSON 객체 추출"""
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
        
        json_str = text[json_start:json_end].strip()
        return json.loads(json_str)
    
    def _validate_and_normalize(self, parsed: Dict[str, Any]) -> Dict[str, Any]:
        """파싱 결과 검증 및 정규화"""
        if "filters" not in parsed:
            parsed["filters"] = {}
        if "semantic_keywords" not in parsed:
            parsed["semantic_keywords"] = []
        if "intent" not in parsed:
            parsed["intent"] = "panel_search"
        if "limit" not in parsed:
            parsed["limit"] = None
        
        # filters 정규화
        filters = parsed.get("filters", {})
        if not isinstance(filters, dict):
            parsed["filters"] = {}
        
        # semantic_keywords 정규화
        keywords = parsed.get("semantic_keywords", [])
        if not isinstance(keywords, list):
            parsed["semantic_keywords"] = []
        
        # limit 정규화
        limit = parsed.get("limit")
        if limit is not None:
            try:
                parsed["limit"] = int(limit)
            except (ValueError, TypeError):
                parsed["limit"] = None
        
        return parsed

