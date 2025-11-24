"""
통합 검색 서비스
- 자동 전략 선택
- Fallback 로직 포함
"""
from typing import Dict, Any, Optional
from app.services.llm.parser import LlmStructuredParser
from app.services.search.strategy.selector import StrategySelector
from app.services.search.strategy.filter_first import FilterFirstSearch
from app.services.search.strategy.semantic_first import SemanticFirstSearch
from app.services.search.strategy.hybrid import HybridSearch


class SearchService:
    """통합 검색 서비스"""
    
    def __init__(self):
        self.parser = LlmStructuredParser()
        self.selector = StrategySelector()
        self._filter_search = None
        self._semantic_search = None
        self._hybrid_search = None
    
    @property
    def filter_search(self):
        """필터 검색 서비스 (lazy loading)"""
        if self._filter_search is None:
            self._filter_search = FilterFirstSearch()
        return self._filter_search
    
    @property
    def semantic_search(self):
        """의미 검색 서비스 (lazy loading)"""
        if self._semantic_search is None:
            print(f"[INFO] semantic_search 서비스 초기화 (임베딩 모델 로딩)")
            self._semantic_search = SemanticFirstSearch()
        return self._semantic_search
    
    @property
    def hybrid_search(self):
        """하이브리드 검색 서비스 (lazy loading)"""
        if self._hybrid_search is None:
            print(f"[INFO] hybrid_search 서비스 초기화 (임베딩 모델 로딩)")
            self._hybrid_search = HybridSearch()
        return self._hybrid_search
    
    def search(
        self,
        user_query: str,
        model: Optional[str] = None,
        min_results: int = 1
    ) -> Dict[str, Any]:
        """
        통합 검색 실행 (자동 전략 선택 + Fallback)
        
        Args:
            user_query: 사용자 자연어 질의
            model: 사용할 LLM 모델
            min_results: 최소 결과 수
        
        Returns:
            검색 결과 딕셔너리
        """
        print(f"[DEBUG] ========== 검색 시작 ==========")
        print(f"[DEBUG] 사용자 질의: {user_query}")
        parsed = self.parser.parse(user_query, model)
        print(f"[DEBUG] LLM 파싱 결과:")
        print(f"  filters: {parsed.get('filters')}")
        print(f"  semantic_keywords: {parsed.get('semantic_keywords')}")
        print(f"  limit: {parsed.get('limit')}")
        
        # 전략 선택
        strategy = self.selector.select_search_mode(parsed)
        print(f"[DEBUG] 선택된 전략: {strategy}")
        
        filters = parsed.get("filters", {})
        semantic_keywords = parsed.get("semantic_keywords", [])
        limit = parsed.get("limit")
        
        # 검색 실행
        result = self._execute_search(strategy, filters, semantic_keywords, limit)
        
        print(f"[DEBUG] 초기 검색 결과: count={result.get('count', 0)}, has_results={result.get('has_results', False)}")
        
        # Fallback 로직
        if not result.get("has_results") or result.get("count", 0) < min_results:
            print(f"[DEBUG] Fallback 검토: min_results={min_results}, 현재 결과={result.get('count', 0)}")
            result = self._try_fallback(
                strategy,
                filters,
                semantic_keywords,
                limit,
                result
            )
        
        # 결과에 메타데이터 추가
        result["parsed_query"] = parsed
        result["selected_strategy"] = strategy
        result["strategy_info"] = self.selector.get_strategy_info(strategy)
        
        print(f"[DEBUG] ========== 최종 결과 ==========")
        print(f"  전략: {strategy}")
        print(f"  결과 개수: {result.get('count', 0)}")
        print(f"  ====================================")
        
        return result
    
    def _execute_search(
        self,
        strategy: str,
        filters: Dict[str, Any],
        semantic_keywords: list,
        limit: Optional[int]
    ) -> Dict[str, Any]:
        """검색 전략에 따라 검색 실행"""
        if strategy == "filter_first":
            return self.filter_search.search(filters=filters, limit=limit)
        elif strategy == "semantic_first":
            return self.semantic_search.search(semantic_keywords=semantic_keywords, limit=limit)
        elif strategy == "hybrid":
            return self.hybrid_search.search(filters=filters, semantic_keywords=semantic_keywords, limit=limit)
        else:
            return {
                "results": [],
                "count": 0,
                "strategy": strategy,
                "has_results": False,
                "error": f"알 수 없는 전략: {strategy}"
            }
    
    def _try_fallback(
        self,
        original_strategy: str,
        filters: Dict[str, Any],
        semantic_keywords: list,
        limit: Optional[int],
        original_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Fallback 로직"""
        fallback_result = original_result.copy()
        fallback_result["fallback_attempted"] = True
        
        if original_strategy == "semantic_first":
            has_filters = bool(filters) and any(v is not None and v != "" for v in filters.values())
            if has_filters:
                print(f"[INFO] Fallback 실행: semantic_first → hybrid")
                hybrid_result = self.hybrid_search.search(filters=filters, semantic_keywords=semantic_keywords, limit=limit)
                if hybrid_result.get("has_results") and hybrid_result.get("count", 0) > original_result.get("count", 0):
                    fallback_result = hybrid_result
                    fallback_result["fallback_used"] = "hybrid"
        
        elif original_strategy == "filter_first":
            has_semantic = bool(semantic_keywords) and len(semantic_keywords) > 0
            if has_semantic:
                print(f"[INFO] Fallback 실행: filter_first → semantic_first")
                semantic_result = self.semantic_search.search(semantic_keywords=semantic_keywords, limit=limit)
                if semantic_result.get("has_results") and semantic_result.get("count", 0) > original_result.get("count", 0):
                    fallback_result = semantic_result
                    fallback_result["fallback_used"] = "semantic_first"
        
        return fallback_result

