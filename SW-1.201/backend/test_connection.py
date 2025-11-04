"""데이터베이스 연결 테스트 (IP 주소 지정 가능)"""
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

import psycopg2
from app.config import Config

def test_connection_with_ip(host_ip=None):
    """특정 IP로 데이터베이스 연결 테스트"""
    try:
        db_config = Config.get_db_config()
        
        # IP 주소가 지정되면 사용
        if host_ip:
            db_config['host'] = host_ip
            print(f"🔧 지정된 IP 주소 사용: {host_ip}")
        
        print("📋 DB 연결 정보:")
        print(f"  Host: {db_config['host']}")
        print(f"  Port: {db_config['port']}")
        print(f"  Database: {db_config['database']}")
        print(f"  User: {db_config['user']}")
        print()
        
        print("🔌 연결 시도 중...")
        
        # 연결 문자열 생성 (원격 연결을 위해 타임아웃 증가)
        conn_string = (
            f"host={db_config['host']} "
            f"port={db_config['port']} "
            f"dbname={db_config['database']} "
            f"user={db_config['user']} "
            f"password={db_config['password']} "
            f"connect_timeout=30"
        )
        
        # 직접 연결
        conn = psycopg2.connect(conn_string)
        
        # 인코딩 설정
        try:
            conn.set_client_encoding('UTF8')
        except:
            pass
        
        # 연결 테스트
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ 데이터베이스 연결 성공!")
        print(f"📊 PostgreSQL 버전: {version[0][:60]}...")
        
        cursor.close()
        conn.close()
        print("\n✅ 연결 종료 완료")
        
        return True
        
    except psycopg2.OperationalError as e:
        print(f"❌ 연결 실패: {e}")
        print("\n💡 가능한 원인:")
        print("   1. IP 주소가 잘못되었거나 접근 불가")
        print("   2. 포트가 차단되었거나 방화벽 설정 문제")
        print("   3. PostgreSQL 서버가 실행 중이지 않음")
        print("   4. pg_hba.conf에서 접근이 허용되지 않음")
        return False
    except Exception as e:
        print(f"❌ 오류 발생: {type(e).__name__}: {e}")
        return False

if __name__ == '__main__':
    import sys
    
    # 명령줄에서 IP 주소 받기
    if len(sys.argv) > 1:
        test_ip = sys.argv[1]
        print(f"🎯 테스트 IP: {test_ip}\n")
        test_connection_with_ip(test_ip)
    else:
        print("📝 사용법: python test_connection.py [IP주소]")
        print("   예: python test_connection.py 192.168.1.100")
        print("\n현재 설정으로 테스트:")
        test_connection_with_ip()
