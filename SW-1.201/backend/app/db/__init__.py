"""데이터베이스 모듈"""
from flask import Flask


def init_db(app: Flask):
    """데이터베이스 초기화"""
    # 연결 풀은 get_db_connection() 호출 시 자동으로 초기화됨
    # 필요시 여기서 초기 연결 테스트를 수행할 수 있습니다
    
    @app.teardown_appcontext
    def close_db(error):
        """요청 종료 시 DB 연결 정리"""
        # 연결 풀은 자동으로 관리되므로 특별한 작업 불필요
        pass