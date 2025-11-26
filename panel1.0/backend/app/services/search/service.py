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
        print(f"  search_text: {parsed.get('search_text')}")
        print(f"  limit: {parsed.get('limit')}")
        
        # 전략 선택
        strategy = self.selector.select_search_mode(parsed)
        print(f"[DEBUG] 선택된 전략: {strategy}")
        
        filters = parsed.get("filters", {})
        semantic_keywords = parsed.get("semantic_keywords", [])
        search_text = parsed.get("search_text")  # LLM이 생성한 풍부한 설명 문장
        limit = parsed.get("limit")
        
        # 검색 실행
        result = self._execute_search(strategy, filters, semantic_keywords, search_text, limit)
        
        print(f"[DEBUG] 초기 검색 결과: count={result.get('count', 0)}, has_results={result.get('has_results', False)}")
        
        # Fallback 로직
        if not result.get("has_results") or result.get("count", 0) < min_results:
            print(f"[DEBUG] Fallback 검토: min_results={min_results}, 현재 결과={result.get('count', 0)}")
            result = self._try_fallback(
                strategy,
                filters,
                semantic_keywords,
                parsed.get("search_text"),
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
        search_text: Optional[str] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """검색 전략에 따라 검색 실행"""
        if strategy == "filter_first":
            return self.filter_search.search(filters=filters, limit=limit)
        elif strategy == "semantic_first":
            # Pure Vector Search: search_text 우선 사용 (LLM이 생성한 풍부한 설명 문장)
            return self.semantic_search.search(
                semantic_keywords=semantic_keywords, 
                search_text=search_text,
                limit=limit
            )
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
        search_text: Optional[str] = None,
        limit: Optional[int] = None,
        original_result: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Fallback 로직"""
        fallback_result = original_result.copy()
        fallback_result["fallback_attempted"] = True
        
        if original_strategy == "semantic_first":
            # semantic_first 결과가 없을 때 fallback 시도
            # 1. distance_threshold를 완화하여 재시도
            if not original_result.get("has_results") or original_result.get("count", 0) == 0:
                print(f"[INFO] Fallback 실행: semantic_first (distance_threshold 완화)")
                # distance_threshold를 None으로 설정하여 모든 결과를 가져온 후 벡터 정렬만 적용
                from app.services.data.vector import VectorSearchService
                vector_service = VectorSearchService()
                # search_text 우선 사용, 없으면 semantic_keywords 결합
                fallback_search_text = search_text or (" ".join(semantic_keywords) if semantic_keywords else "")
                if fallback_search_text:
                    try:
                        fallback_results = vector_service.execute_hybrid_search_sql(
                            embedding_input=fallback_search_text,
                            filters=None,
                            limit=limit or 500,
                            distance_threshold=None,  # distance threshold 제거
                            semantic_keywords=None  # 키워드 필터링도 제거 (Pure Vector Search)
                        )
                        if fallback_results and len(fallback_results) > 0:
                            fallback_result = {
                                "results": fallback_results,
                                "count": len(fallback_results),
                                "total_count": len(fallback_results),
                                "strategy": "semantic_first",
                                "keywords_used": semantic_keywords,
                                "has_results": True,
                                "fallback_used": "semantic_first_no_threshold"
                            }
                            print(f"[INFO] Fallback 성공: {len(fallback_results)}개 결과")
                    except Exception as e:
                        print(f"[WARN] Fallback 실패: {e}")
            
            # 2. 필터가 있으면 hybrid로 fallback
            has_filters = bool(filters) and any(v is not None and v != "" for v in filters.values())
            if has_filters and (not fallback_result.get("has_results") or fallback_result.get("count", 0) == 0):
                print(f"[INFO] Fallback 실행: semantic_first → hybrid")
                hybrid_result = self.hybrid_search.search(filters=filters, semantic_keywords=semantic_keywords, limit=limit)
                if hybrid_result.get("has_results") and hybrid_result.get("count", 0) > fallback_result.get("count", 0):
                    fallback_result = hybrid_result
                    fallback_result["fallback_used"] = "hybrid"
        
        elif original_strategy == "filter_first":
            has_semantic = bool(semantic_keywords) and len(semantic_keywords) > 0
            if has_semantic:
                print(f"[INFO] Fallback 실행: filter_first → semantic_first")
                semantic_result = self.semantic_search.search(
                    semantic_keywords=semantic_keywords, 
                    search_text=search_text,
                    limit=limit
                )
                if semantic_result.get("has_results") and semantic_result.get("count", 0) > original_result.get("count", 0):
                    fallback_result = semantic_result
                    fallback_result["fallback_used"] = "semantic_first"
        
        elif original_strategy == "hybrid":
            # 하이브리드 검색에서 키워드 필터링이 너무 엄격해서 결과가 0개일 때
            # 키워드 필터링 없이 벡터 검색만 시도 (구조적 필터는 유지)
            has_filters = bool(filters) and any(v is not None and v != "" for v in filters.values())
            has_semantic = bool(semantic_keywords) and len(semantic_keywords) > 0
            
            if has_filters and has_semantic:
                # 키워드 필터링 없이 구조적 필터 + 벡터 검색만 시도
                print(f"[INFO] Fallback 실행: hybrid (키워드 필터링 제거) → 구조적 필터 + 벡터 검색")
                from app.services.data.vector import VectorSearchService
                vector_service = VectorSearchService()
                search_text = " ".join(semantic_keywords)
                
                try:
                    # 키워드 필터링 없이 벡터 검색만 실행 (구조적 필터는 유지)
                    fallback_results = vector_service.execute_hybrid_search_sql(
                        embedding_input=search_text,
                        filters=filters,
                        limit=limit if limit is not None else 1000,
                        distance_threshold=None,
                        semantic_keywords=None  # 키워드 필터링 제거
                    )
                    
                    if fallback_results and len(fallback_results) > 0:
                        print(f"[INFO] Fallback 성공: {len(fallback_results)}개 결과 (키워드 필터링 제거)")
                        fallback_result = {
                            "results": fallback_results,
                            "count": len(fallback_results),
                            "total_count": len(fallback_results),
                            "strategy": "hybrid",
                            "filters_applied": filters or {},
                            "keywords_used": semantic_keywords,
                            "has_results": True,
                            "fallback_used": "hybrid_no_keyword_filter"
                        }
                except Exception as e:
                    print(f"[WARN] Fallback 실패: {e}")
                    # Fallback 실패 시 원본 결과 반환
        
        return fallback_result

