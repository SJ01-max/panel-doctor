"""간단한 데이터베이스 연결 테스트 (환경 변수 직접 설정)"""
import psycopg2

# DBeaver 연결 정보 직접 설정
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'Retail',
    'user': 'postgres',
    'password': '753951'
}

def test_connection():
    """데이터베이스 연결 테스트"""
    try:
        print("🔌 데이터베이스 연결 시도 중...")
        print(f"   Host: {DB_CONFIG['host']}")
        print(f"   Port: {DB_CONFIG['port']}")
        print(f"   Database: {DB_CONFIG['database']}")
        print(f"   User: {DB_CONFIG['user']}")
        print()
        
        # 연결 시 인코딩 파라미터 추가
        conn = psycopg2.connect(
            **DB_CONFIG,
            client_encoding='UTF8'
        )
        
        # 연결 테스트
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ 데이터베이스 연결 성공!")
        print(f"📊 PostgreSQL 버전: {version[0][:50]}...")  # 버전 문자열이 길 수 있으므로 일부만 출력
        
        # 테이블 목록 확인 (인코딩 문제 방지를 위해 바이너리 모드로)
        try:
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
            tables = cursor.fetchall()
            print(f"\n📋 사용 가능한 테이블 ({len(tables)}개):")
            for table in tables[:10]:  # 처음 10개만 표시
                # 문자열을 안전하게 출력
                table_name = str(table[0]).encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
                print(f"   - {table_name}")
            if len(tables) > 10:
                print(f"   ... 외 {len(tables) - 10}개")
        except UnicodeDecodeError as ue:
            print(f"\n⚠️ 테이블 목록 조회 중 인코딩 오류 발생 (무시하고 계속 진행)")
            print(f"   오류 상세: {ue}")
        
        cursor.close()
        conn.close()
        print("\n✅ 연결 종료 완료")
        
        return True
    except psycopg2.OperationalError as e:
        print(f"❌ 데이터베이스 연결 실패: {e}")
        print("\n📝 확인 사항:")
        print("1. PostgreSQL 서버가 실행 중인지 확인")
        print("2. DBeaver에서 연결이 정상적으로 되는지 확인")
        print("3. 방화벽 설정 확인")
        return False
    except UnicodeDecodeError as e:
        print(f"❌ 인코딩 오류 발생: {e}")
        print(f"   위치: {e.start} - {e.end}")
        print(f"   원인: 데이터베이스의 일부 데이터가 UTF-8이 아닌 인코딩으로 저장되어 있습니다.")
        print(f"\n💡 해결 방법:")
        print(f"   1. 데이터베이스의 인코딩 확인: SELECT datname, pg_encoding_to_char(encoding) FROM pg_database;")
        print(f"   2. 데이터베이스 인코딩을 UTF8로 변경 또는 데이터 정리 필요")
        return False
    except Exception as e:
        print(f"❌ 오류 발생: {type(e).__name__}: {e}")
        import traceback
        print(f"\n상세 오류:")
        traceback.print_exc()
        return False

if __name__ == '__main__':
    test_connection()
