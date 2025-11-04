"""URL 방식으로 데이터베이스 연결 테스트"""
import os
from dotenv import load_dotenv

# .env 파일 로드 (인코딩 명시)
try:
    load_dotenv(encoding='utf-8')
except UnicodeDecodeError:
    try:
        load_dotenv(encoding='cp949')
    except:
        load_dotenv(encoding='utf-8-sig')

from app.config import Config
from app.db.connection import get_db_connection, return_db_connection, close_all_connections

def test_connection():
    """데이터베이스 연결 테스트"""
    try:
        # 환경 변수 확인
        print("📋 환경 변수 확인:")
        print(f"  DATABASE_URL: {os.environ.get('DATABASE_URL', 'NOT SET')}")
        print()
        
        # Config에서 DB 설정 가져오기
        db_config = Config.get_db_config()
        print("📋 파싱된 DB 설정:")
        print(f"  Host: {db_config['host']}")
        print(f"  Port: {db_config['port']}")
        print(f"  Database: {db_config['database']}")
        print(f"  User: {db_config['user']}")
        print(f"  Password: {'*' * len(db_config['password']) if db_config['password'] else 'NOT SET'}")
        print()
        
        print("🔌 데이터베이스 연결 시도 중...")
        conn = get_db_connection()
        
        # 연결 테스트
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ 데이터베이스 연결 성공!")
        print(f"📊 PostgreSQL 버전: {version[0][:80]}...")
        
        # 테이블 목록 확인
        try:
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
                LIMIT 10;
            """)
            tables = cursor.fetchall()
            print(f"\n📋 사용 가능한 테이블 (처음 10개):")
            for table in tables:
                print(f"   - {table[0]}")
        except Exception as e:
            print(f"\n⚠️ 테이블 목록 조회 중 오류: {e}")
        
        cursor.close()
        return_db_connection(conn)
        print("\n✅ 연결 풀에 반환 완료")
        
        close_all_connections()
        return True
        
    except Exception as e:
        print(f"❌ 데이터베이스 연결 실패: {e}")
        import traceback
        print(f"\n상세 오류:")
        traceback.print_exc()
        return False

if __name__ == '__main__':
    test_connection()
