"""직접 연결 테스트 (연결 풀 없이)"""
import psycopg2
from app.config import Config

def test_direct_connection():
    """연결 풀 없이 직접 연결 테스트"""
    try:
        db_config = Config.get_db_config()
        
        print("📋 DB 설정:")
        print(f"  Host: {db_config['host']}")
        print(f"  Port: {db_config['port']}")
        print(f"  Database: {db_config['database']}")
        print(f"  User: {db_config['user']}")
        print()
        
        print("🔌 직접 연결 시도 중...")
        
        # 연결 문자열 생성
        conn_string = (
            f"host={db_config['host']} "
            f"port={db_config['port']} "
            f"dbname={db_config['database']} "
            f"user={db_config['user']} "
            f"password={db_config['password']} "
            f"client_encoding=UTF8"
        )
        
        # 직접 연결
        conn = psycopg2.connect(conn_string)
        
        # 연결 직후 Python 코드로 클라이언트 인코딩 설정
        try:
            # psycopg2의 set_client_encoding 메서드 사용
            conn.set_client_encoding('UTF8')
        except Exception:
            # 실패 시 SQL 명령으로 시도
            try:
                with conn.cursor() as cursor:
                    cursor.execute("SET client_encoding TO 'UTF8';")
                    conn.commit()
            except:
                pass
        
        # 연결 테스트
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ 데이터베이스 연결 성공!")
        print(f"📊 PostgreSQL 버전: {version[0][:80]}...")
        
        # 인코딩 확인
        cursor.execute("SHOW client_encoding;")
        encoding = cursor.fetchone()[0]
        print(f"📝 클라이언트 인코딩: {encoding}")
        
        # 테이블 목록 확인 (에러 처리)
        try:
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
                LIMIT 5;
            """)
            tables = cursor.fetchall()
            print(f"\n📋 사용 가능한 테이블 (처음 5개):")
            for table in tables:
                print(f"   - {table[0]}")
        except Exception as e:
            print(f"\n⚠️ 테이블 목록 조회 중 오류: {e}")
        
        cursor.close()
        conn.close()
        print("\n✅ 연결 종료 완료")
        
        return True
        
    except psycopg2.OperationalError as e:
        print(f"❌ 데이터베이스 연결 실패: {e}")
        return False
    except UnicodeDecodeError as e:
        print(f"❌ 인코딩 오류: {e}")
        print(f"\n💡 해결 방법:")
        print(f"   데이터베이스 서버의 인코딩 설정을 확인하세요.")
        return False
    except Exception as e:
        print(f"❌ 오류 발생: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    import os
    from dotenv import load_dotenv
    
    # .env 파일 로드
    try:
        load_dotenv(encoding='utf-8')
    except:
        try:
            load_dotenv(encoding='cp949')
        except:
            load_dotenv(encoding='utf-8-sig')
    
    test_direct_connection()
