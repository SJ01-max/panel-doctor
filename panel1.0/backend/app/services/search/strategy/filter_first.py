"""
필터 우선 검색 모듈 (core_v2 스키마)
"""
from typing import Dict, Any, Optional
from app.services.data.sql_builder import SQLBuilder
from app.services.search.strategy.base import SearchStrategy


class FilterFirstSearch(SearchStrategy):
    """필터 우선 검색 서비스"""
    
    def __init__(self):
        self.sql_builder = SQLBuilder()
    
    def search(
        self,
        filters: Optional[Dict[str, Any]] = None,
        semantic_keywords: Optional[list] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        필터 기반 검색 실행
        
        Args:
            filters: 필터 딕셔너리
            semantic_keywords: 사용하지 않음 (필터 우선이므로)
            limit: 결과 제한 수
        
        Returns:
            {
                "results": [...],
                "count": 100,
                "strategy": "filter_first",
                "filters_applied": {...}
            }
        """
        print(f"[DEBUG] FilterFirstSearch.search 호출:")
        print(f"  filters: {filters}")
        print(f"  limit: {limit}")
        
        filters = filters or {}
        
        # SQL 쿼리 실행
        results = self.sql_builder.execute_filter_query(filters, limit)
        
        # 전체 개수 및 통계 추출 (결과에서 메타데이터로 전달된 경우)
        total_count = len(results)
        region_stats = []
        age_stats = []
        if results and len(results) > 0:
            if '_total_count' in results[0]:
                total_count = results[0]['_total_count']
            if '_region_stats' in results[0]:
                region_stats = results[0]['_region_stats']
            if '_age_stats' in results[0]:
                age_stats = results[0]['_age_stats']
            # 메타데이터 제거
            for result in results:
                if '_total_count' in result:
                    del result['_total_count']
                if '_region_stats' in result:
                    del result['_region_stats']
                if '_age_stats' in result:
                    del result['_age_stats']
        
        result_dict = {
            "results": results,
            "count": total_count,  # 전체 개수 사용
            "strategy": "filter_first",
            "filters_applied": filters,
            "has_results": len(results) > 0,
            "region_stats": region_stats,  # 지역별 통계 추가
            "age_stats": age_stats  # 연령대별 통계 추가
        }
        
        print(f"[DEBUG] FilterFirstSearch 결과: count={result_dict['count']} (반환된 결과: {len(results)}개), has_results={result_dict['has_results']}")
        
        return result_dict

