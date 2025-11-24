"""
의미 우선 검색 모듈 (core_v2 스키마)
"""
from typing import Dict, Any, List, Optional
import os
from app.services.data.vector import VectorSearchService
from app.services.search.strategy.base import SearchStrategy


class SemanticFirstSearch(SearchStrategy):
    """의미 우선 검색 서비스"""
    
    def __init__(self):
        print(f"[INFO] SemanticFirstSearch 초기화 - VectorSearchService Singleton 사용")
        self.vector_service = VectorSearchService()
        self.distance_threshold = float(
            os.environ.get("SEMANTIC_DISTANCE_THRESHOLD", "0.65")
        )
    
    def search(
        self,
        filters: Optional[Dict[str, Any]] = None,
        semantic_keywords: Optional[List[str]] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        의미 기반 벡터 검색 실행
        
        Args:
            filters: 사용하지 않음 (의미 검색 우선이므로)
            semantic_keywords: 의미 키워드 리스트
            limit: 결과 제한 수
        
        Returns:
            {
                "results": [...],
                "count": 100,
                "strategy": "semantic_first",
                "keywords_used": [...]
            }
        """
        if not semantic_keywords:
            return {
                "results": [],
                "count": 0,
                "strategy": "semantic_first",
                "keywords_used": [],
                "has_results": False
            }
        
        # 키워드를 하나의 검색 텍스트로 결합
        search_text = " ".join(semantic_keywords)
        
        try:
            # 벡터 검색 실행 (core_v2 스키마)
            # 통계 정확도를 위해 DEFAULT_LIMIT = 500 설정
            # Vector search는 HNSW 인덱스로 빠르므로 500개도 성능에 큰 영향 없음
            DEFAULT_LIMIT = 500
            effective_limit = limit if limit is not None else DEFAULT_LIMIT
            results = self.vector_service.execute_hybrid_search_sql(
                embedding_input=search_text,
                filters=None,  # semantic_first는 필터 없음
                limit=effective_limit,
                distance_threshold=self.distance_threshold
            )
            
            return {
                "results": results or [],
                "count": len(results) if results else 0,
                "strategy": "semantic_first",
                "keywords_used": semantic_keywords,
                "has_results": len(results) > 0 if results else False
            }
        except Exception as e:
            print(f"[ERROR] 의미 검색 실행 실패: {e}")
            import traceback
            traceback.print_exc()
            return {
                "results": [],
                "count": 0,
                "strategy": "semantic_first",
                "keywords_used": semantic_keywords,
                "has_results": False,
                "error": str(e)
            }

