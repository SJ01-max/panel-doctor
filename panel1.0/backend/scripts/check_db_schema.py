"""
데이터베이스 스키마 확인 스크립트
벤치마크 실행 전 테이블 구조 확인용
"""
import psycopg2
from pgvector.psycopg2 import register_vector

DB_CONFIG = {
    "host": "database.c3gymesumce0.ap-northeast-2.rds.amazonaws.com",
    "port": 5432,
    "dbname": "postgres",
    "user": "postgres",
    "password": "xi*VtLL<WD7sZsIbbIZCdF(yMS?y"
}

def check_schema():
    """데이터베이스 스키마 확인"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        register_vector(conn)
        cur = conn.cursor()
        
        print("=" * 80)
        print("데이터베이스 스키마 확인")
        print("=" * 80)
        
        # 1. core_v2 스키마의 임베딩 관련 테이블 확인
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'core_v2' 
            AND table_name LIKE '%embedding%'
            ORDER BY table_name
        """)
        tables = cur.fetchall()
        
        print(f"\n📋 임베딩 관련 테이블:")
        if tables:
            for (table_name,) in tables:
                print(f"  - {table_name}")
                
                # 각 테이블의 컬럼 확인
                cur.execute("""
                    SELECT column_name, data_type, character_maximum_length
                    FROM information_schema.columns
                    WHERE table_schema = 'core_v2' 
                    AND table_name = %s
                    ORDER BY ordinal_position
                """, (table_name,))
                columns = cur.fetchall()
                
                print(f"    컬럼:")
                for col_name, data_type, max_len in columns:
                    if max_len:
                        print(f"      - {col_name}: {data_type}({max_len})")
                    else:
                        print(f"      - {col_name}: {data_type}")
                
                # 데이터 개수 확인
                cur.execute(f'SELECT COUNT(*) FROM core_v2."{table_name}"')
                count = cur.fetchone()[0]
                print(f"    레코드 수: {count:,}개")
                
                # 임베딩 차원 확인 (vector 타입인 경우)
                cur.execute("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'core_v2' 
                    AND table_name = %s
                    AND data_type = 'USER-DEFINED'
                """, (table_name,))
                vector_cols = cur.fetchall()
                
                if vector_cols:
                    for (col_name,) in vector_cols:
                        # 실제 데이터에서 차원 확인
                        cur.execute(f"""
                            SELECT {col_name}::text
                            FROM core_v2."{table_name}"
                            WHERE {col_name} IS NOT NULL
                            LIMIT 1
                        """)
                        sample = cur.fetchone()
                        if sample and sample[0]:
                            vec_str = sample[0].strip('[]')
                            if vec_str:
                                dimension = len(vec_str.split(','))
                                print(f"    {col_name} 차원: {dimension}차원")
        else:
            print("  ❌ 임베딩 관련 테이블을 찾을 수 없습니다.")
        
        # 2. doc_embedding 테이블 존재 여부 확인
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'core_v2' 
            AND table_name = 'doc_embedding'
        """)
        doc_embedding_exists = cur.fetchone() is not None
        
        print(f"\n📋 core_v2.doc_embedding 테이블:")
        if doc_embedding_exists:
            print("  ✅ 존재함")
            # 컬럼 확인
            cur.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'core_v2' 
                AND table_name = 'doc_embedding'
                ORDER BY ordinal_position
            """)
            columns = cur.fetchall()
            for col_name, data_type in columns:
                print(f"    - {col_name}: {data_type}")
        else:
            print("  ❌ 존재하지 않음")
            print("  💡 벤치마크 스크립트는 core_v2.doc_embedding 테이블을 사용합니다.")
            print("     실제 프로젝트는 core_v2.panel_embedding을 사용하는 것으로 보입니다.")
        
        print("\n" + "=" * 80)
        print("✅ 스키마 확인 완료")
        print("=" * 80)
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_schema()









