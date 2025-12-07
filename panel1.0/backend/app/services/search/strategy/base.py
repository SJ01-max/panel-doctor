"""
검색 전략 인터페이스
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional


class SearchStrategy(ABC):
    """검색 전략 추상 클래스"""
    
    @abstractmethod
    def search(
        self,
        filters: Optional[Dict[str, Any]] = None,
        semantic_keywords: Optional[List[str]] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        검색 실행
        
        Args:
            filters: 구조화된 필터 딕셔너리
            semantic_keywords: 의미 키워드 리스트
            limit: 결과 제한 수
        
        Returns:
            {
                "results": [...],
                "count": 100,
                "strategy": "filter_first" | "semantic_first" | "hybrid",
                "has_results": True
            }
        """
        pass

