"""애플리케이션 설정"""
import os
from urllib.parse import urlparse, unquote


class Config:
    """기본 설정"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # 데이터베이스 설정
    # 방법 1: DATABASE_URL 사용 (우선순위 높음)
    # 예: postgresql://user:password@localhost:5432/dbname
    # 예: jdbc:postgresql://localhost:5432/Retail (JDBC 형식도 지원)
    DATABASE_URL = os.environ.get('DATABASE_URL')
    
    # 방법 2: 개별 설정 값 사용 (DBeaver 연결 정보와 동일하게 설정)
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = int(os.environ.get('DB_PORT', 5432))
    DB_NAME = os.environ.get('DB_NAME', 'postgres')
    DB_USER = os.environ.get('DB_USER', 'postgres')
    # 비밀번호에서 따옴표 제거 (환경변수에서 가져올 때)
    _db_password_raw = os.environ.get('DB_PASSWORD', '1124')
    DB_PASSWORD = _db_password_raw.strip('"').strip("'") if _db_password_raw else '1124'
    
    # API 설정
    API_PREFIX = '/api'
    
    # CORS 설정 (기본: Vite 5173, 추가로 3000도 허용)
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(',')
    
    @classmethod
    def get_db_config(cls):
        """데이터베이스 연결 정보 반환"""
        # DATABASE_URL이 있으면 우선 사용
        if cls.DATABASE_URL:
            # JDBC URL 형식 (jdbc:postgresql://...) 또는 표준 URL 형식 지원
            db_url = cls.DATABASE_URL
            
            # JDBC URL 형식인 경우 제거
            if db_url.startswith('jdbc:'):
                db_url = db_url.replace('jdbc:', '')
            
            # postgresql:// 형식으로 변환
            if not db_url.startswith('postgresql://'):
                if '://' not in db_url:
                    # postgresql:// 없이 host:port/db 형식인 경우
                    db_url = f'postgresql://{cls.DB_USER}:{cls.DB_PASSWORD}@{db_url}'
                else:
                    # 다른 프로토콜인 경우 postgresql로 변경
                    db_url = db_url.replace(db_url.split('://')[0], 'postgresql', 1)
            
            # URL 파싱
            parsed = urlparse(db_url)
            
            # 사용자명과 비밀번호가 URL에 없으면 환경 변수의 개별 값 사용
            user = unquote(parsed.username) if parsed.username else cls.DB_USER
            # URL 인코딩된 비밀번호 디코딩
            password = unquote(parsed.password) if parsed.password else cls.DB_PASSWORD
            
            return {
                'host': parsed.hostname or cls.DB_HOST,
                'port': parsed.port or cls.DB_PORT,
                'database': parsed.path.lstrip('/') if parsed.path else cls.DB_NAME,
                'user': user,
                'password': password
            }
        else:
            # 개별 설정 값 사용
            return {
                'host': cls.DB_HOST,
                'port': cls.DB_PORT,
                'database': cls.DB_NAME,
                'user': cls.DB_USER,
                'password': cls.DB_PASSWORD
            }


class DevelopmentConfig(Config):
    """개발 환경 설정"""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """프로덕션 환경 설정"""
    DEBUG = False
    TESTING = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
