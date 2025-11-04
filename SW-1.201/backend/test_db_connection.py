"""데이터베이스 연결 테스트 스크립트"""
import os
from dotenv import load_dotenv
from app.db.connection import get_db_connection, return_db_connection, close_all_connections

# .env 파일 로드 (인코딩 명시)
try:
    load_dotenv(encoding='utf-8')
except UnicodeDecodeError:
    # UTF-8 실패 시 다른 인코딩 시도
    try:
        load_dotenv(encoding='cp949')  # Windows 한글 인코딩
    except:
        load_dotenv(encoding='utf-8-sig')  # BOM 포함 UTF-8

def test_connection():
    """데이터베이스 연결 테스트"""
    try:
        # 환경 변수 확인
        print("📋 환경 변수 확인:")
        print(f"  DB_HOST: {os.environ.get('DB_HOST', 'NOT SET')}")
        print(f"  DB_PORT: {os.environ.get('DB_PORT', 'NOT SET')}")
        print(f"  DB_NAME: {os.environ.get('DB_NAME', 'NOT SET')}")
        print(f"  DB_USER: {os.environ.get('DB_USER', 'NOT SET')}")
        print(f"  DB_PASSWORD: {'*' * len(os.environ.get('DB_PASSWORD', '')) if os.environ.get('DB_PASSWORD') else 'NOT SET'}")
        print()
        
        print("🔌 데이터베이스 연결 시도 중...")
        conn = get_db_connection()
        
        # 연결 테스트
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ 데이터베이스 연결 성공!")
        print(f"📊 PostgreSQL 버전: {version[0]}")
        
        # 연결 반환
        return_db_connection(conn)
        print("✅ 연결 풀에 반환 완료")
        
        return True
    except Exception as e:
        print(f"❌ 데이터베이스 연결 실패: {e}")
        print("\n📝 확인 사항:")
        print("1. .env 파일이 backend 폴더에 있는지 확인")
        print("2. DBeaver 연결 정보와 .env 파일의 설정이 일치하는지 확인")
        print("3. PostgreSQL 서버가 실행 중인지 확인")
        return False
    finally:
        close_all_connections()

if __name__ == '__main__':
    test_connection()
