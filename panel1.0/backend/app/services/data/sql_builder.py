"""
SQL 쿼리 빌더 (core_v2 스키마)
"""
from typing import Dict, Any, List, Optional, Tuple
from app.services.data.executor import execute_sql_safe


class SQLBuilder:
    """SQL 쿼리 빌더 (core_v2 스키마 전용)"""
    
    @staticmethod
    def build_filter_query(
        filters: Dict[str, Any],
        limit: Optional[int] = None,
        table_name: str = "core_v2.respondent"
    ) -> Tuple[str, Dict[str, Any]]:
        """
        필터 기반 안전한 SQL 쿼리 생성 (core_v2 스키마)
        
        Args:
            filters: 필터 딕셔너리
                {
                    "age": "20s" | "30s" | ...,
                    "gender": "M" | "F",
                    "region": "서울" | "부산" | ...
                }
            limit: 결과 제한 수
            table_name: 테이블명 (스키마 포함)
        
        Returns:
            (query, params) 튜플
        """
        where_conditions = []
        params = {}
        
        # 연령 필터 (birth_year 사용)
        if filters.get("age") or filters.get("age_range"):
            age_range = filters.get("age") or filters.get("age_range")
            if age_range == "20s":
                where_conditions.append(
                    "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                )
                params["age_min"] = 20
                params["age_max"] = 29
            elif age_range == "30s":
                where_conditions.append(
                    "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                )
                params["age_min"] = 30
                params["age_max"] = 39
            elif age_range == "40s":
                where_conditions.append(
                    "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                )
                params["age_min"] = 40
                params["age_max"] = 49
            elif age_range == "50s":
                where_conditions.append(
                    "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                )
                params["age_min"] = 50
                params["age_max"] = 59
            elif age_range == "60s" or age_range == "60s+":
                where_conditions.append(
                    "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) >= %(age_min)s"
                )
                params["age_min"] = 60
            elif age_range == "70s" or age_range == "70s+":
                where_conditions.append(
                    "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) >= %(age_min)s"
                )
                params["age_min"] = 70
            elif age_range == "80s" or age_range == "80s+":
                where_conditions.append(
                    "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) >= %(age_min)s"
                )
                params["age_min"] = 80
        
        # 성별 필터
        if filters.get("gender"):
            gender = filters["gender"]
            if gender in ["M", "남"]:
                where_conditions.append("gender = %(gender)s")
                params["gender"] = "남"
            elif gender in ["F", "여"]:
                where_conditions.append("gender = %(gender)s")
                params["gender"] = "여"
        
        # 지역 필터
        if filters.get("region"):
            region = filters["region"]
            where_conditions.append("region LIKE %(region)s")
            params["region"] = f"%{region}%"
        
        # 태그 필터 (interests 배열과 교집합)
        # 대소문자 구분 없이 매칭하기 위해 EXISTS 서브쿼리 사용
        if filters.get("tags") and isinstance(filters["tags"], list) and len(filters["tags"]) > 0:
            tags = [tag.strip() for tag in filters["tags"] if tag and tag.strip()]
            if tags:
                tag_conditions = []
                for i, tag in enumerate(tags):
                    param_name = f"tag_{i}"
                    # 개행 제거하여 SQL 안전성 검사 통과
                    tag_conditions.append(f"EXISTS (SELECT 1 FROM unnest(interests) AS interest WHERE LOWER(interest) = LOWER(%({param_name})s))")
                    params[param_name] = tag
                
                if tag_conditions:
                    where_conditions.append(f"(interests IS NOT NULL AND ({' OR '.join(tag_conditions)}))")
        
        # WHERE 절 구성
        where_clause = ""
        if where_conditions:
            where_clause = "WHERE " + " AND ".join(where_conditions)
        
        # LIMIT 절
        limit_clause = ""
        if limit:
            limit_clause = f"LIMIT {int(limit)}"
        
        # 테이블명 스키마 분리 및 따옴표 처리
        if '.' in table_name:
            schema, table = table_name.split('.', 1)
            quoted_table = f'"{schema}"."{table}"'
        else:
            quoted_table = f'"{table_name}"'
        
        # 최종 쿼리
        query = f"""
            SELECT 
                respondent_id,
                gender,
                birth_year,
                region,
                district
            FROM {quoted_table}
            {where_clause}
            {limit_clause}
        """.strip()
        
        return query, params
    
    @staticmethod
    def execute_filter_query(
        filters: Dict[str, Any],
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        필터 쿼리 실행 (core_v2 스키마)
        
        Returns:
            검색 결과 리스트
        """
        query, params = SQLBuilder.build_filter_query(filters, limit)
        
        print(f"[DEBUG] SQLBuilder.execute_filter_query:")
        print(f"  filters: {filters}")
        print(f"  limit: {limit}")
        print(f"  generated SQL: {query}")
        print(f"  params: {params}")
        
        try:
            # WHERE 절 재구성 (build_filter_query에서 생성한 params 재사용)
            where_conditions = []
            where_params = params.copy()
            
            # 연령 필터
            if filters.get("age") or filters.get("age_range"):
                age_range = filters.get("age") or filters.get("age_range")
                if age_range == "20s":
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                    )
                    where_params["age_min"] = 20
                    where_params["age_max"] = 29
                elif age_range == "30s":
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                    )
                    where_params["age_min"] = 30
                    where_params["age_max"] = 39
                elif age_range == "40s":
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                    )
                    where_params["age_min"] = 40
                    where_params["age_max"] = 49
                elif age_range == "50s":
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                    )
                    where_params["age_min"] = 50
                    where_params["age_max"] = 59
                elif age_range == "60s" or age_range == "60s+":
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) >= %(age_min)s"
                    )
                    where_params["age_min"] = 60
                elif age_range == "70s" or age_range == "70s+":
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) >= %(age_min)s"
                    )
                    where_params["age_min"] = 70
                elif age_range == "80s" or age_range == "80s+":
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) >= %(age_min)s"
                    )
                    where_params["age_min"] = 80
            
            # 성별 필터
            if filters.get("gender"):
                gender = filters["gender"]
                if gender in ["M", "남"]:
                    where_conditions.append("gender = %(gender)s")
                    where_params["gender"] = "남"
                elif gender in ["F", "여"]:
                    where_conditions.append("gender = %(gender)s")
                    where_params["gender"] = "여"
            
            # 지역 필터
            if filters.get("region"):
                region = filters["region"]
                where_conditions.append("region LIKE %(region)s")
                where_params["region"] = f"%{region}%"
            
            # 태그 필터 (interests 배열과 교집합)
            # 대소문자 구분 없이 매칭하기 위해 EXISTS 서브쿼리 사용
            if filters.get("tags") and isinstance(filters["tags"], list) and len(filters["tags"]) > 0:
                tags = [tag.strip() for tag in filters["tags"] if tag and tag.strip()]
                if tags:
                    tag_conditions = []
                    for i, tag in enumerate(tags):
                        param_name = f"tag_{i}"
                        # 개행 제거하여 SQL 안전성 검사 통과
                        tag_conditions.append(f"EXISTS (SELECT 1 FROM unnest(interests) AS interest WHERE LOWER(interest) = LOWER(%({param_name})s))")
                        where_params[param_name] = tag
                    
                    if tag_conditions:
                        where_conditions.append(f"(interests IS NOT NULL AND ({' OR '.join(tag_conditions)}))")
            
            where_clause = ""
            if where_conditions:
                where_clause = "WHERE " + " AND ".join(where_conditions)
            
            # 테이블명 스키마 분리 및 따옴표 처리
            table_name_used = "core_v2.respondent"  # 기본 테이블명
            if '.' in table_name_used:
                schema, table = table_name_used.split('.', 1)
                quoted_table = f'"{schema}"."{table}"'
            else:
                quoted_table = f'"{table_name_used}"'
            
            # 전체 개수 먼저 계산 (LIMIT 없이 COUNT 쿼리)
            count_query = f"SELECT COUNT(*) as total_count FROM {quoted_table} {where_clause}".strip()
            count_result = execute_sql_safe(
                query=count_query,
                params=where_params,
                limit=1
            )
            total_count = count_result[0]['total_count'] if count_result and len(count_result) > 0 else 0
            print(f"[DEBUG] 전체 개수: {total_count}개")
            
            # 전체 검색 결과에 대한 지역별 통계 계산 (LIMIT 없이)
            region_stats_result = []
            try:
                region_stats_query = f"""
                    SELECT 
                        region,
                        COUNT(*) as region_count
                    FROM {quoted_table}
                    {where_clause}
                    GROUP BY region
                    ORDER BY region_count DESC
                    LIMIT 10
                """.strip()
                
                region_stats_result = execute_sql_safe(
                    query=region_stats_query,
                    params=where_params,
                    limit=10
                )
                print(f"[DEBUG] 지역별 통계: {len(region_stats_result)}개 지역")
            except Exception as e:
                print(f"[WARN] 지역별 통계 계산 실패: {e}")
                import traceback
                traceback.print_exc()
            
            # 전체 검색 결과에 대한 연령대별 통계 계산 (LIMIT 없이)
            age_stats_result = []
            try:
                # 연령대를 10년 단위로 그룹핑 (20세-29세 → 20대, 30세-39세 → 30대)
                age_stats_query = f"""
                    SELECT 
                        CASE 
                            WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 10 AND 19 THEN '10대'
                            WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 20 AND 29 THEN '20대'
                            WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 30 AND 39 THEN '30대'
                            WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 40 AND 49 THEN '40대'
                            WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 50 AND 59 THEN '50대'
                            WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 60 AND 69 THEN '60대'
                            WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 70 AND 79 THEN '70대'
                            WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) >= 80 THEN '80대'
                            ELSE '기타'
                        END as age_group,
                        COUNT(*) as age_count
                    FROM {quoted_table}
                    {where_clause}
                    GROUP BY age_group
                    ORDER BY age_count DESC
                    LIMIT 10
                """.strip()
                
                age_stats_result = execute_sql_safe(
                    query=age_stats_query,
                    params=where_params,
                    limit=10
                )
                print(f"[DEBUG] 연령대별 통계: {len(age_stats_result)}개 연령대")
            except Exception as e:
                print(f"[WARN] 연령대별 통계 계산 실패: {e}")
                import traceback
                traceback.print_exc()
            
            # 실제 데이터 조회 (limit 적용)
            # 통계 정확도를 위해 DEFAULT_LIMIT = 1000 설정
            # SQL 필터링은 매우 빠르므로 1000개도 성능에 거의 영향 없음
            DEFAULT_LIMIT = 1000
            effective_limit = limit if limit is not None else DEFAULT_LIMIT
            results = execute_sql_safe(
                query=query,
                params=params,
                limit=effective_limit
            )
            
            # 프론트엔드 호환성을 위해 응답 형식 변환
            # birth_year → age_text 변환
            from datetime import datetime
            current_year = datetime.now().year
            for result in results:
                if 'birth_year' in result and result['birth_year']:
                    age = current_year - result['birth_year']
                    # 년생 정보 제거하고 나이만 표시
                    result['age_text'] = f"만 {age}세"
                # doc_id 필드 추가 (하위 호환성)
                if 'respondent_id' in result:
                    result['doc_id'] = result['respondent_id']
                # 전체 개수를 메타데이터로 추가
                result['_total_count'] = total_count
                # 지역별 통계를 메타데이터로 추가
                result['_region_stats'] = region_stats_result
                # 연령대별 통계를 메타데이터로 추가
                result['_age_stats'] = age_stats_result
            
            print(f"[DEBUG] SQL 실행 결과: {len(results)}개 (전체: {total_count}개)")
            return results
        except Exception as e:
            print(f"[ERROR] 필터 쿼리 실행 실패: {e}")
            import traceback
            traceback.print_exc()
            return []

