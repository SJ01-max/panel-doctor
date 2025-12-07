"""
패널 테이블 스키마 관리 유틸리티
- interests 컬럼 자동 생성
- 스키마 버전 관리
"""
from app.db.connection import get_db_connection, return_db_connection


def ensure_interests_column_exists():
    """
    core_v2.respondent 테이블에 interests 컬럼이 없으면 자동 생성
    
    Returns:
        bool: 컬럼이 이미 존재했으면 True, 새로 생성했으면 False
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # interests 컬럼 존재 여부 확인
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'core_v2'
                    AND table_name = 'respondent'
                    AND column_name = 'interests'
                );
            """)
            
            exists = cursor.fetchone()[0]
            
            if not exists:
                # interests 컬럼 추가 (TEXT[] 타입)
                cursor.execute("""
                    ALTER TABLE "core_v2"."respondent"
                    ADD COLUMN interests TEXT[];
                """)
                
                # 인덱스 생성 (배열 검색 최적화)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_respondent_interests_gin
                    ON "core_v2"."respondent"
                    USING GIN (interests);
                """)
                
                conn.commit()
                print("[INFO] core_v2.respondent 테이블에 interests 컬럼을 추가했습니다.")
                return False
            else:
                print("[INFO] core_v2.respondent 테이블에 interests 컬럼이 이미 존재합니다.")
                return True
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] interests 컬럼 생성 실패: {e}")
        raise
    finally:
        return_db_connection(conn)

