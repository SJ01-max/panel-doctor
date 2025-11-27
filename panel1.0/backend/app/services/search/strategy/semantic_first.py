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
        # Semantic First는 SQL 필터 없이 오직 벡터만 믿고 검색하는 모드
        # 관련 있는 데이터 마지노선이 약 0.51 정도이므로, 여유 있게 0.60으로 설정
        # 관련 있는 사람은 대부분 포함하면서 엉뚱한 데이터(노이즈)는 쳐낼 수 있음
        self.distance_threshold = float(
            os.environ.get("SEMANTIC_DISTANCE_THRESHOLD", "0.60")
        )
    
    def search(
        self,
        filters: Optional[Dict[str, Any]] = None,
        semantic_keywords: Optional[List[str]] = None,
        search_text: Optional[str] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        의미 기반 벡터 검색 실행 (Pure Sentence-based Vector Search)
        
        Args:
            filters: 사용하지 않음 (의미 검색 우선이므로)
            semantic_keywords: 의미 키워드 리스트 (deprecated - use search_text instead)
            search_text: 풍부한 설명 문장 (LLM이 생성한 descriptive sentence)
            limit: 결과 제한 수
        
        Returns:
            {
                "results": [...],
                "count": 100,
                "strategy": "semantic_first",
                "search_text_used": "..."
            }
        """
        # search_text가 우선순위 (LLM이 생성한 풍부한 설명 문장)
        # semantic_keywords는 fallback (하위 호환성)
        if not search_text and semantic_keywords:
            # 하위 호환성: 키워드를 하나의 검색 텍스트로 결합
            search_text = " ".join(semantic_keywords)
        
        if not search_text:
            return {
                "results": [],
                "count": 0,
                "strategy": "semantic_first",
                "search_text_used": None,
                "has_results": False
            }
        
        try:
            # 벡터 검색 실행 (core_v2 스키마)
            # 통계 정확도를 위해 DEFAULT_LIMIT = 5000 설정
            # Vector search는 HNSW 인덱스로 빠르므로 5000개도 성능에 큰 영향 없음
            DEFAULT_LIMIT = 5000
            effective_limit = limit if limit is not None else DEFAULT_LIMIT
            # semantic_first는 의미 기반 검색이므로 키워드 필터링 없이 벡터 검색만 사용
            # 키워드 필터링은 정확한 텍스트 매칭을 요구하므로 의미 기반 검색의 목적과 맞지 않음
            results = self.vector_service.execute_hybrid_search_sql(
                embedding_input=search_text,
                filters=None,  # semantic_first는 필터 없음
                limit=effective_limit,
                distance_threshold=self.distance_threshold,
                semantic_keywords=None  # 키워드 필터링 제거 - 벡터 검색만으로 의미 매칭
            )
            
            # total_count 추출 (메타데이터에서)
            # vector.py에서 distance threshold를 포함한 COUNT 쿼리 결과를 전달
            total_count = len(results) if results else 0
            if results and len(results) > 0 and '_total_count' in results[0]:
                total_count = results[0]['_total_count']
                # 메타데이터 제거
                for result in results:
                    if '_total_count' in result:
                        del result['_total_count']
            
            print(f"[DEBUG] semantic_first total_count: {total_count} (벡터 검색 distance threshold 포함 COUNT)")
            
            return {
                "results": results or [],
                "count": len(results) if results else 0,
                "total_count": total_count,  # ★ 실제 반환된 결과 개수 (벡터 검색 특성상)
                "strategy": "semantic_first",
                "search_text_used": search_text,
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
                "search_text_used": search_text,
                "has_results": False,
                "error": str(e)
            }

