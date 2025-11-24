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
        filters = parsed_query.get("filters", {})
        semantic_keywords = parsed_query.get("semantic_keywords", [])
        
        # Correction: semantic_keywords에 정형 필드가 들어왔는지 재검사
        corrected = StrategySelector._correct_structured_fields(semantic_keywords, filters)
        if corrected:
            filters = corrected["filters"]
            semantic_keywords = corrected["semantic_keywords"]
            parsed_query["filters"] = filters
            parsed_query["semantic_keywords"] = semantic_keywords
            print(f"[CORRECTION] 정형 필드 보정 완료: filters={filters}, semantic_keywords={semantic_keywords}")
        
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
    def _correct_structured_fields(semantic_keywords: list, filters: Dict[str, Any]) -> Dict[str, Any] | None:
        """semantic_keywords에서 정형 필드를 찾아 filters로 이동"""
        if not semantic_keywords:
            return None
        
        import re
        corrected_filters = filters.copy() if filters else {}
        corrected_keywords = []
        corrected = False
        
        region_list = ["서울", "부산", "경기", "대구", "인천", "광주", "대전", "울산", 
                       "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]
        
        for keyword in semantic_keywords:
            if not isinstance(keyword, str):
                corrected_keywords.append(keyword)
                continue
            
            keyword_clean = keyword.strip()
            moved = False
            
            # 지역명 체크
            for region in region_list:
                if region in keyword_clean or keyword_clean in region:
                    if not corrected_filters.get("region"):
                        corrected_filters["region"] = region
                        print(f"[CORRECTION] strategy_selector: '{keyword}' → filters.region='{region}'")
                        corrected = True
                        moved = True
                        break
            
            if moved:
                continue
            
            # 연령 체크
            age_match = re.search(r'(\d+)대', keyword_clean)
            if age_match:
                age_num = int(age_match.group(1))
                if 20 <= age_num < 70:
                    age_value = f"{age_num//10*10}s"
                    if not corrected_filters.get("age"):
                        corrected_filters["age"] = age_value
                        print(f"[CORRECTION] strategy_selector: '{keyword}' → filters.age='{age_value}'")
                        corrected = True
                        moved = True
            
            if moved:
                continue
            
            # 성별 체크
            gender_map = {
                "남자": "M", "남성": "M", "남": "M",
                "여자": "F", "여성": "F", "여": "F"
            }
            for gender_term, gender_code in gender_map.items():
                if gender_term in keyword_clean:
                    if not corrected_filters.get("gender"):
                        corrected_filters["gender"] = gender_code
                        print(f"[CORRECTION] strategy_selector: '{keyword}' → filters.gender='{gender_code}'")
                        corrected = True
                        moved = True
                        break
            
            if not moved:
                corrected_keywords.append(keyword)
        
        if corrected:
            return {
                "filters": corrected_filters,
                "semantic_keywords": corrected_keywords
            }
        
        return None
    
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

