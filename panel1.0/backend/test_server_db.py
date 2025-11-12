"""서버 DB 연결 테스트 (실제 연결 풀 사용)"""
from dotenv import load_dotenv
load_dotenv()

from app.config import Config
from app.db.connection import get_db_connection, return_db_connection

print("=" * 60)
print("서버 DB 연결 테스트 (연결 풀 사용)")
print("=" * 60)

try:
    db_config = Config.get_db_config()
    print(f"\n연결 정보:")
    print(f"  호스트: {db_config['host']}")
    print(f"  포트: {db_config['port']}")
    print(f"  데이터베이스: {db_config['database']}")
    print(f"  사용자: {db_config['user']}")
    
    print(f"\n연결 풀을 통한 연결 시도 중...")
    conn = get_db_connection()
    cur = conn.cursor()
    
    # 버전 확인
    cur.execute('SELECT version()')
    version = cur.fetchone()[0]
    print(f"\n연결 성공!")
    print(f"PostgreSQL 버전: {version[:80]}...")
    
    # 현재 데이터베이스 확인
    cur.execute('SELECT current_database()')
    current_db = cur.fetchone()[0]
    print(f"현재 데이터베이스: {current_db}")
    
    # 테이블 목록 확인 (core 스키마)
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'core' 
        LIMIT 5
    """)
    tables = [row[0] for row in cur.fetchall()]
    if tables:
        print(f"\ncore 스키마 테이블 (일부): {', '.join(tables)}")
    else:
        print(f"\ncore 스키마에 테이블이 없거나 접근 권한이 없습니다.")
    
    cur.close()
    return_db_connection(conn)
    
    print("\n" + "=" * 60)
    print("서버 DB 연결 정상!")
    print("=" * 60)
    
except Exception as e:
    print(f"\n연결 실패: {e}")
    import traceback
    traceback.print_exc()

