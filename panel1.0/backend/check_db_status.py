"""서버 DB 연결 상태 확인"""
from dotenv import load_dotenv
load_dotenv()

from app.config import Config
from app.db.connection import get_db_connection, return_db_connection
import psycopg2

print("=" * 60)
print("서버 DB 연결 상태 확인")
print("=" * 60)

# 1. .env 파일에서 로드된 설정 확인
db_config = Config.get_db_config()
print("\n1. 현재 DB 설정:")
print(f"   호스트: {db_config['host']}")
print(f"   포트: {db_config['port']}")
print(f"   데이터베이스: {db_config['database']}")
print(f"   사용자: {db_config['user']}")

# 2. 직접 DB 연결 테스트
print("\n2. 직접 DB 연결 테스트:")
try:
    # SSL 연결 포함
    db_config_with_ssl = {**db_config, 'sslmode': 'require'}
    conn = psycopg2.connect(**db_config_with_ssl, connect_timeout=10)
    cur = conn.cursor()
    
    # 버전 확인
    cur.execute('SELECT version()')
    version = cur.fetchone()[0]
    print("   연결: 성공!")
    print(f"   PostgreSQL 버전: {version[:60]}...")
    
    # 현재 데이터베이스 확인
    cur.execute('SELECT current_database()')
    current_db = cur.fetchone()[0]
    print(f"   현재 데이터베이스: {current_db}")
    
    # 테이블 목록 확인
    cur.execute("""
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'core'
    """)
    table_count = cur.fetchone()[0]
    print(f"   core 스키마 테이블 수: {table_count}")
    
    cur.close()
    conn.close()
    
except psycopg2.OperationalError as e:
    print(f"   연결 실패: {str(e)[:100]}")
    if 'password authentication failed' in str(e):
        print("   원인: 비밀번호 인증 실패")
        print("   해결: AWS RDS 보안 그룹에서 현재 IP 허용 필요")
except Exception as e:
    print(f"   오류: {e}")

# 3. 연결 풀을 통한 연결 테스트
print("\n3. 연결 풀을 통한 연결 테스트:")
try:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT current_database()')
    current_db = cur.fetchone()[0]
    print(f"   연결 풀 연결: 성공!")
    print(f"   현재 데이터베이스: {current_db}")
    cur.close()
    return_db_connection(conn)
except Exception as e:
    print(f"   연결 풀 연결 실패: {str(e)[:100]}")

print("\n" + "=" * 60)

# 결론
if 'database.c3gymesumce0' in db_config['host']:
    print("결론: 서버 DB로 설정되어 있습니다!")
    print("      (비밀번호 인증 실패 시 AWS RDS 보안 그룹 확인 필요)")
else:
    print("결론: 아직 로컬 DB로 설정되어 있습니다.")

print("=" * 60)

