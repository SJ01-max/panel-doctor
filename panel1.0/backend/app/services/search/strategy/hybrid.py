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
        # Hybrid Search는 SQL 필터(나이/성별/지역)가 이미 100% 정확하게 대상을 좁혀놨음
        # 벡터 점수로 순서(Ranking)만 정렬하는 게 베스트이므로 기본값은 None (제한 없음)
        # 필요시 환경변수로 0.75 (매우 헐겁게) 설정 가능
        hybrid_threshold_env = os.environ.get("HYBRID_DISTANCE_THRESHOLD")
        if hybrid_threshold_env:
            self.distance_threshold = float(hybrid_threshold_env)
        else:
            self.distance_threshold = None  # 기본값: 제한 없음
    
    def search(
        self,
        filters: Optional[Dict[str, Any]] = None,
        semantic_keywords: Optional[List[str]] = None,
        search_text: Optional[str] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        하이브리드 검색 실행 (SQL 필터 + 벡터 검색)
        
        Args:
            filters: 필터 딕셔너리
            semantic_keywords: 의미 키워드 리스트 (키워드 필터링용)
            search_text: LLM이 생성한 풍부한 설명 문장 (벡터 검색용, 우선순위 높음)
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
        if not semantic_keywords and not search_text:
            return {
                "results": [],
                "count": 0,
                "strategy": "hybrid",
                "filters_applied": filters or {},
                "keywords_used": [],
                "has_results": False,
                "error": "semantic_keywords 또는 search_text가 필요합니다"
            }
        
        # ★ search_text 우선 사용 (LLM이 생성한 풍부한 설명 문장)
        # search_text가 없으면 semantic_keywords를 결합 (하위 호환성)
        if not search_text and semantic_keywords:
            search_text = " ".join(semantic_keywords)
        
        try:
            # limit이 없으면 구조적 필터만으로 먼저 카운트를 구함
            # 통계 정확도를 위해 DEFAULT_LIMIT = 1000 유지
            # 하이브리드 검색은 구조적 필터 + 벡터 검색이므로 충분한 샘플 필요
            DEFAULT_LIMIT = 1000
            effective_limit = limit if limit is not None else DEFAULT_LIMIT
            
            # 하이브리드 검색 실행 (core_v2 스키마)
            # 키워드 필터링 + 벡터 정렬 결합
            # SQL 필터가 이미 100% 정확하게 대상을 좁혔으므로, 벡터 점수로 순서(Ranking)만 정렬
            # distance_threshold는 None(제한 없음) 또는 0.75(매우 헐겁게)로 설정
            results = self.vector_service.execute_hybrid_search_sql(
                embedding_input=search_text,
                filters=filters,
                limit=effective_limit,
                distance_threshold=self.distance_threshold,  # None 또는 0.75 - 구조적 필터 통과자는 모두 보여주고 벡터로 정렬만
                semantic_keywords=semantic_keywords  # 키워드 필터링을 위한 키워드 리스트 전달
            )
            
            # total_count 추출 (메타데이터에서)
            total_count = len(results) if results else 0
            if results and len(results) > 0 and '_total_count' in results[0]:
                total_count = results[0]['_total_count']
                # 메타데이터 제거
                for result in results:
                    if '_total_count' in result:
                        del result['_total_count']
            
            return {
                "results": results or [],
                "count": len(results) if results else 0,
                "total_count": total_count,  # ★ TRUE Total matches in DB
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

