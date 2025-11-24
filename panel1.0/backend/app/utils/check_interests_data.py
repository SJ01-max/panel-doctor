"""
interests 데이터 확인 및 디버깅 유틸리티
"""
from app.db.connection import get_db_connection, return_db_connection
from app.services.data.executor import execute_sql_safe


def check_interests_data():
    """
    interests 컬럼의 데이터 현황 확인
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # interests가 NULL이 아닌 레코드 수
            cursor.execute("""
                SELECT COUNT(*) 
                FROM "core_v2"."respondent" 
                WHERE interests IS NOT NULL;
            """)
            not_null_count = cursor.fetchone()[0]
            
            # interests가 NULL인 레코드 수
            cursor.execute("""
                SELECT COUNT(*) 
                FROM "core_v2"."respondent" 
                WHERE interests IS NULL;
            """)
            null_count = cursor.fetchone()[0]
            
            # interests가 빈 배열인 레코드 수
            cursor.execute("""
                SELECT COUNT(*) 
                FROM "core_v2"."respondent" 
                WHERE interests IS NOT NULL AND array_length(interests, 1) IS NULL;
            """)
            empty_array_count = cursor.fetchone()[0]
            
            # 실제 interests 값 샘플 (상위 20개)
            cursor.execute("""
                SELECT DISTINCT interests 
                FROM "core_v2"."respondent" 
                WHERE interests IS NOT NULL 
                AND array_length(interests, 1) > 0
                LIMIT 20;
            """)
            sample_interests = cursor.fetchall()
            
            print(f"[INFO] interests 데이터 현황:")
            print(f"  - NULL이 아닌 레코드: {not_null_count}개")
            print(f"  - NULL인 레코드: {null_count}개")
            print(f"  - 빈 배열인 레코드: {empty_array_count}개")
            print(f"  - 샘플 interests 값:")
            for row in sample_interests:
                print(f"    {row[0]}")
            
            return {
                'not_null_count': not_null_count,
                'null_count': null_count,
                'empty_array_count': empty_array_count,
                'sample_interests': [row[0] for row in sample_interests]
            }
    except Exception as e:
        print(f"[ERROR] interests 데이터 확인 실패: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        return_db_connection(conn)


def check_tag_match(tag: str):
    """
    특정 태그가 interests 배열에 포함된 패널 수 확인
    """
    try:
        # execute_sql_safe는 세미콜론을 허용하지 않으므로 직접 쿼리 실행
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                # 대소문자 구분 없이 검색
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM "core_v2"."respondent"
                    WHERE interests IS NOT NULL
                    AND (
                        EXISTS (
                            SELECT 1 
                            FROM unnest(interests) AS interest
                            WHERE LOWER(interest) = LOWER(%s)
                        )
                    )
                """, (tag,))
                
                count = cursor.fetchone()[0] or 0
                print(f"[INFO] 태그 '{tag}' 매칭 결과: {count}명")
                return count
        finally:
            return_db_connection(conn)
    except Exception as e:
        print(f"[ERROR] 태그 매칭 확인 실패: {e}")
        import traceback
        traceback.print_exc()
        return 0

