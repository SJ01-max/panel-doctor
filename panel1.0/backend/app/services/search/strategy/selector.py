"""
자동 검색 전략 선택기
"""
from typing import Dict, Any, Literal

SearchStrategy = Literal["filter_first", "semantic_first", "hybrid"]


class StrategySelector:
    """
    검색 전략 자동 선택기
    
    규칙:
    - filter-only: filters ≠ {} AND semantic_keywords = [] → filter_first
    - semantic-only: filters = {} AND semantic_keywords ≠ [] → semantic_first
    - hybrid: filters ≠ {} AND semantic_keywords ≠ [] → hybrid
    """
    
    @staticmethod
    def select_search_mode(parsed_query: Dict[str, Any]) -> SearchStrategy:
        """
        파싱된 쿼리에서 검색 전략 선택
        
        Args:
            parsed_query: LLM 파싱 결과
                {
                    "filters": {...},
                    "semantic_keywords": [...],
                    ...
                }
        
        Returns:
            "filter_first" | "semantic_first" | "hybrid"
        """
        # LLM이 파싱한 filters / semantic_keywords를 그대로 신뢰해서 사용한다.
        # 더 이상 semantic_keywords를 보고 filters를 보정하거나 강제로 주입하지 않는다.
        filters = parsed_query.get("filters", {})
        semantic_keywords = parsed_query.get("semantic_keywords", [])
        
        # filters가 비어있지 않은지 확인
        has_filters = bool(filters) and any(
            v is not None and v != "" 
            for v in filters.values()
        )
        
        # semantic_keywords가 비어있지 않은지 확인
        has_semantic = bool(semantic_keywords) and len(semantic_keywords) > 0
        
        # 전략 선택
        if has_filters and not has_semantic:
            strategy = "filter_first"
        elif not has_filters and has_semantic:
            strategy = "semantic_first"
        elif has_filters and has_semantic:
            strategy = "hybrid"
        else:
            strategy = "filter_first"
        
        print(f"[INFO] 전략 선택: {strategy}")
        print(f"  - filters: {filters} (has_filters={has_filters})")
        print(f"  - semantic_keywords: {semantic_keywords} (has_semantic={has_semantic})")
        
        return strategy
    
    @staticmethod
    def get_strategy_info(strategy: SearchStrategy) -> Dict[str, Any]:
        """전략 정보 반환"""
        info = {
            "filter_first": {
                "name": "필터 우선 검색",
                "description": "구조화된 필터(연령, 성별, 지역) 기반 SQL 검색",
                "uses_sql": True,
                "uses_embedding": False
            },
            "semantic_first": {
                "name": "의미 우선 검색",
                "description": "임베딩 기반 벡터 검색",
                "uses_sql": False,
                "uses_embedding": True
            },
            "hybrid": {
                "name": "하이브리드 검색",
                "description": "SQL 필터 + 벡터 검색 결합",
                "uses_sql": True,
                "uses_embedding": True
            }
        }
        return info.get(strategy, {})

