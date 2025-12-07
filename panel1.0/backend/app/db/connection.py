"""데이터베이스 연결 관리"""
from typing import Optional, Dict, Any
import psycopg2
from psycopg2 import pool
from psycopg2.extensions import connection
from flask import current_app
from app.config import Config


_connection_pool: Optional[pool.ThreadedConnectionPool] = None
_last_db_config: Optional[Dict[str, Any]] = None


def get_db_connection() -> connection:
    """데이터베이스 연결 풀에서 연결 가져오기"""
    global _connection_pool, _last_db_config
    
    # 현재 DB 설정 가져오기
    db_config = Config.get_db_config()
    
    # DB 설정이 변경되었거나 연결 풀이 없으면 재생성
    if _connection_pool is None or _last_db_config != db_config:
        
        try:
            # 연결 풀 생성 (개별 파라미터 사용)
            # 타임아웃을 길게 설정 (원격 연결 시 필요)
            
            # SSL 모드 설정 (환경변수로 제어 가능, 기본값: require - RDS는 SSL 필수)
            import os
            ssl_mode = os.environ.get('DB_SSLMODE', 'require')  # require: SSL 필수, prefer: 선택적, disable: 비활성화
            
            print(f"[DEBUG] DB 연결 시도: host={db_config['host']}, port={db_config['port']}, database={db_config['database']}, user={db_config['user']}, sslmode={ssl_mode}")
            
            _connection_pool = pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=20,
                host=db_config['host'],
                port=db_config['port'],
                database=db_config['database'],
                user=db_config['user'],
                password=db_config['password'],
                connect_timeout=30,  # 원격 연결을 위해 30초로 증가
                sslmode=ssl_mode,  # 환경변수로 제어 가능
                options='-c statement_timeout=20000'  # 기본 statement_timeout 20초 설정
            )
            
            # 연결 풀 생성 성공
            print(f"[성공] 데이터베이스 연결 풀 생성: {db_config['host']}:{db_config['port']}/{db_config['database']}")
            
            # 초기 연결에서 클라이언트 인코딩을 UTF8로 설정
            test_conn = _connection_pool.getconn()
            try:
                # Python 코드에서 클라이언트 인코딩 설정
                test_conn.set_client_encoding('UTF8')
            except Exception as enc_err:
                # set_client_encoding 실패 시 SQL 명령으로 시도
                try:
                    with test_conn.cursor() as cursor:
                        cursor.execute("SET client_encoding TO 'UTF8';")
                        test_conn.commit()
                except Exception:
                    # 인코딩 설정 실패해도 연결은 계속 사용 가능
                    try:
                        test_conn.rollback()
                    except:
                        pass
            finally:
                _connection_pool.putconn(test_conn)
            
            # 현재 설정 저장
            _last_db_config = db_config.copy()
                
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"[실패] 데이터베이스 연결 실패: {e}")
            print(f"[DEBUG] 연결 설정: host={db_config.get('host')}, port={db_config.get('port')}, database={db_config.get('database')}, user={db_config.get('user')}")
            print(f"[DEBUG] 상세 오류:\n{error_trace}")
            raise
    elif _last_db_config != db_config:
        # 설정이 변경되었으면 기존 풀 닫고 재생성
        if _connection_pool:
            try:
                _connection_pool.closeall()
            except:
                pass
        _connection_pool = None
        # 재귀 호출로 새 풀 생성
        return get_db_connection()
    
    # 연결 가져오기
    conn = _connection_pool.getconn()
    
    # 매번 연결 시 Python 코드로 클라이언트 인코딩을 UTF8로 설정
    try:
        # psycopg2의 set_client_encoding 메서드 사용 (가장 안전한 방법)
        conn.set_client_encoding('UTF8')
    except Exception:
        # set_client_encoding 실패 시 SQL 명령으로 시도
        try:
            with conn.cursor() as cursor:
                cursor.execute("SET client_encoding TO 'UTF8';")
                conn.commit()
        except Exception:
            # 인코딩 설정 실패해도 연결은 사용 가능
            try:
                conn.rollback()
            except:
                pass
    
    return conn


def return_db_connection(conn: connection):
    """데이터베이스 연결을 풀에 반환"""
    if _connection_pool:
        _connection_pool.putconn(conn)


def close_all_connections():
    """모든 데이터베이스 연결 종료"""
    global _connection_pool
    if _connection_pool:
        _connection_pool.closeall()
        _connection_pool = None
