"""
패널 수 계산 유틸리티
- 연령, 성별, 지역, 태그 필터를 포함한 패널 수 계산
- 타겟 그룹 생성/수정 시 사용
"""
from typing import Dict, Any, List, Optional
from app.services.data.executor import execute_sql_safe
from app.utils.panel_schema import ensure_interests_column_exists


def calculate_panel_count(
    age_range: Optional[str] = None,
    gender: Optional[str] = None,
    region: Optional[str] = None,
    tags: Optional[List[str]] = None
) -> int:
    """
    필터 조건에 따른 패널 수 계산
    
    Args:
        age_range: 연령대 ("20s", "30s" 등)
        gender: 성별 ("M", "F" 또는 "남", "여")
        region: 지역 (예: "서울", "부산")
        tags: 관심사 태그 리스트 (예: ["OTT", "금융"])
    
    Returns:
        int: 조건에 맞는 패널 수
    """
    # interests 컬럼이 없으면 자동 생성
    ensure_interests_column_exists()
    
    where_conditions = []
    where_params = {}
    
    # 연령대 필터
    if age_range:
        if age_range == '10s':
            where_conditions.append("(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 10 AND 19")
        elif age_range == '20s':
            where_conditions.append("(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 20 AND 29")
        elif age_range == '30s':
            where_conditions.append("(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 30 AND 39")
        elif age_range == '40s':
            where_conditions.append("(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 40 AND 49")
        elif age_range == '50s':
            where_conditions.append("(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 50 AND 59")
        elif age_range == '60s' or age_range == '60s+':
            where_conditions.append("(EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) >= 60")
    
    # 성별 필터
    if gender:
        if gender in ['M', '남']:
            where_conditions.append("gender = %(gender)s")
            where_params['gender'] = '남'
        elif gender in ['F', '여']:
            where_conditions.append("gender = %(gender)s")
            where_params['gender'] = '여'
    
    # 지역 필터
    if region:
        where_conditions.append("region LIKE %(region)s")
        where_params['region'] = f"%{region}%"
    
    # 태그 필터 (interests 배열과 교집합)
    # tags가 1개 이상이면 "interests && ARRAY[...]::text[]" 조건으로 매칭
    # 겹치는 항목이 1개 이상이면 매칭됨 (PostgreSQL 배열 교집합 연산자 &&)
    # NULL 체크 추가: interests IS NOT NULL AND interests && ARRAY[...]
    # 대소문자 구분 없이 매칭하기 위해 LOWER() 사용
    if tags and isinstance(tags, list) and len(tags) > 0:
        # 빈 문자열 제거 및 공백 제거
        clean_tags = [tag.strip() for tag in tags if tag and tag.strip()]
        if clean_tags:
            # 대소문자 구분 없이 매칭하기 위해 배열의 각 요소를 LOWER()로 변환하여 비교
            # PostgreSQL에서는 배열 연산자와 함께 LOWER()를 직접 사용할 수 없으므로
            # EXISTS 서브쿼리를 사용하여 대소문자 구분 없이 매칭
            tag_conditions = []
            for i, tag in enumerate(clean_tags):
                param_name = f'tag_{i}'
                # 개행 제거하여 SQL 안전성 검사 통과
                tag_conditions.append(f"EXISTS (SELECT 1 FROM unnest(interests) AS interest WHERE LOWER(interest) = LOWER(%({param_name})s))")
                where_params[param_name] = tag
            
            if tag_conditions:
                where_conditions.append(f"(interests IS NOT NULL AND ({' OR '.join(tag_conditions)}))")
                
                # 디버깅: interests 데이터 현황 확인
                try:
                    from app.db.connection import get_db_connection, return_db_connection
                    conn = get_db_connection()
                    try:
                        with conn.cursor() as cursor:
                            cursor.execute('SELECT COUNT(*) as count FROM "core_v2"."respondent" WHERE interests IS NOT NULL')
                            interests_count = cursor.fetchone()[0] or 0
                            print(f"[DEBUG] interests가 NULL이 아닌 패널 수: {interests_count}명")
                            
                            if interests_count == 0:
                                print(f"[WARN] interests 컬럼에 데이터가 없습니다. 태그 필터링이 작동하지 않습니다.")
                                print(f"[INFO] interests 데이터를 채우려면 패널 데이터에 관심사 정보를 추가해야 합니다.")
                            else:
                                # 실제 interests 값 샘플 확인
                                cursor.execute('SELECT DISTINCT interests FROM "core_v2"."respondent" WHERE interests IS NOT NULL AND array_length(interests, 1) > 0 LIMIT 5')
                                sample_rows = cursor.fetchall()
                                if sample_rows:
                                    print(f"[DEBUG] interests 값 샘플:")
                                    for row in sample_rows:
                                        print(f"  {row[0]}")
                    finally:
                        return_db_connection(conn)
                except Exception as debug_err:
                    print(f"[WARN] interests 데이터 확인 실패: {debug_err}")
    
    # WHERE 절 구성
    where_clause = ""
    if where_conditions:
        where_clause = "WHERE " + " AND ".join(where_conditions)
    
    # COUNT 쿼리 실행
    count_query = f'SELECT COUNT(*) as total_count FROM "core_v2"."respondent" {where_clause}'.strip()
    
    # 디버깅 로그 추가
    print(f"[DEBUG] 패널 수 계산 쿼리:")
    print(f"  쿼리: {count_query}")
    print(f"  파라미터: {where_params}")
    if tags:
        print(f"  태그: {tags}")
    
    try:
        count_result = execute_sql_safe(
            query=count_query,
            params=where_params if where_params else None,
            limit=1
        )
        
        total_count = count_result[0]['total_count'] if count_result and len(count_result) > 0 else 0
        print(f"[DEBUG] 계산된 패널 수: {total_count}")
        return int(total_count)
    except Exception as e:
        print(f"[ERROR] 패널 수 계산 실패: {e}")
        print(f"[ERROR] 쿼리: {count_query}")
        print(f"[ERROR] 파라미터: {where_params}")
        import traceback
        traceback.print_exc()
        raise


def generate_summary(
    age_range: Optional[str] = None,
    gender: Optional[str] = None,
    region: Optional[str] = None,
    tags: Optional[List[str]] = None
) -> str:
    """
    타겟 그룹 조건을 요약 문자열로 생성
    
    Args:
        age_range: 연령대 ("20s" → "20–29세")
        gender: 성별 ("M" → "남성", "F" → "여성")
        region: 지역
        tags: 관심사 태그 리스트
    
    Returns:
        str: 요약 문자열 (예: "연령 20–29세 · 성별 남성 · 지역 서울 · 태그 OTT, 금융")
    """
    parts = []
    
    # 연령대 변환
    if age_range:
        age_map = {
            '10s': '10–19세',
            '20s': '20–29세',
            '30s': '30–39세',
            '40s': '40–49세',
            '50s': '50–59세',
            '60s': '60세 이상',
            '60s+': '60세 이상'
        }
        age_text = age_map.get(age_range, age_range)
        parts.append(f"연령 {age_text}")
    
    # 성별 변환
    if gender:
        if gender in ['M', '남']:
            parts.append("성별 남성")
        elif gender in ['F', '여']:
            parts.append("성별 여성")
        else:
            parts.append(f"성별 {gender}")
    
    # 지역
    if region:
        parts.append(f"지역 {region}")
    
    # 태그
    if tags and isinstance(tags, list) and len(tags) > 0:
        clean_tags = [tag.strip() for tag in tags if tag and tag.strip()]
        if clean_tags:
            tags_text = ", ".join(clean_tags)
            parts.append(f"태그 {tags_text}")
    
    return " · ".join(parts) if parts else "조건 없음"

