"""서버 DB 연결 테스트"""
from dotenv import load_dotenv
load_dotenv()

from app.config import Config
import psycopg2

print("=" * 60)
print("서버 DB 연결 테스트")
print("=" * 60)

try:
    db_config = Config.get_db_config()
    print(f"\n연결 정보:")
    print(f"  호스트: {db_config['host']}")
    print(f"  포트: {db_config['port']}")
    print(f"  데이터베이스: {db_config['database']}")
    print(f"  사용자: {db_config['user']}")
    print(f"  비밀번호: {'*' * len(db_config['password'])}")
    
    print(f"\n연결 시도 중...")
    # AWS RDS는 SSL 연결 필요
    db_config_with_ssl = {**db_config, 'sslmode': 'require'}
    conn = psycopg2.connect(**db_config_with_ssl)
    cur = conn.cursor()
    
    # 버전 확인
    cur.execute('SELECT version()')
    version = cur.fetchone()[0]
    print(f"\n✅ 연결 성공!")
    print(f"PostgreSQL 버전: {version[:80]}...")
    
    # 데이터베이스 목록 확인
    cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
    databases = [row[0] for row in cur.fetchall()]
    print(f"\n사용 가능한 데이터베이스: {', '.join(databases[:5])}")
    
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
    conn.close()
    
    print("\n" + "=" * 60)
    print("✅ 서버 DB 연결 정상!")
    print("=" * 60)
    
except Exception as e:
    print(f"\n❌ 연결 실패: {e}")
    import traceback
    traceback.print_exc()

