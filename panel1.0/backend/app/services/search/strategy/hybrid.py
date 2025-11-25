"""
하이브리드 검색 모듈 (core_v2 스키마)
"""
from typing import Dict, Any, List, Optional
import os
from app.services.data.vector import VectorSearchService
from app.services.search.strategy.base import SearchStrategy


class HybridSearch(SearchStrategy):
    """하이브리드 검색 서비스"""
    
    def __init__(self):
        print(f"[INFO] HybridSearch 초기화 - VectorSearchService Singleton 사용")
        self.vector_service = VectorSearchService()
        self.distance_threshold = float(
            os.environ.get("HYBRID_DISTANCE_THRESHOLD", "0.65")
        )
    
    def search(
        self,
        filters: Optional[Dict[str, Any]] = None,
        semantic_keywords: Optional[List[str]] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        하이브리드 검색 실행 (SQL 필터 + 벡터 검색)
        
        Args:
            filters: 필터 딕셔너리
            semantic_keywords: 의미 키워드 리스트
            limit: 결과 제한 수
        
        Returns:
            {
                "results": [...],
                "count": 100,
                "strategy": "hybrid",
                "filters_applied": {...},
                "keywords_used": [...]
            }
        """
        if not semantic_keywords:
            return {
                "results": [],
                "count": 0,
                "strategy": "hybrid",
                "filters_applied": filters or {},
                "keywords_used": [],
                "has_results": False,
                "error": "semantic_keywords가 필요합니다"
            }
        
        # 키워드를 하나의 검색 텍스트로 결합
        search_text = " ".join(semantic_keywords)
        
        try:
            # limit이 없으면 구조적 필터만으로 먼저 카운트를 구함
            # 통계 정확도를 위해 DEFAULT_LIMIT = 1000 유지
            # 하이브리드 검색은 구조적 필터 + 벡터 검색이므로 충분한 샘플 필요
            DEFAULT_LIMIT = 36000
            effective_limit = limit if limit is not None else DEFAULT_LIMIT
            
            # 하이브리드 검색 실행 (core_v2 스키마)
            # distance_threshold를 None으로 설정하여 구조적 필터를 만족하는 모든 결과를 가져온 후 벡터 검색으로 정렬
            results = self.vector_service.execute_hybrid_search_sql(
                embedding_input=search_text,
                filters=filters,
                limit=effective_limit,
                distance_threshold=None  # 구조적 필터를 만족하는 모든 결과를 가져온 후 벡터 검색으로 정렬
            )
            
            return {
                "results": results or [],
                "count": len(results) if results else 0,
                "strategy": "hybrid",
                "filters_applied": filters or {},
                "keywords_used": semantic_keywords,
                "has_results": len(results) > 0 if results else False
            }
        except Exception as e:
            print(f"[ERROR] 하이브리드 검색 실행 실패: {e}")
            import traceback
            traceback.print_exc()
            return {
                "results": [],
                "count": 0,
                "strategy": "hybrid",
                "filters_applied": filters or {},
                "keywords_used": semantic_keywords,
                "has_results": False,
                "error": str(e)
            }

