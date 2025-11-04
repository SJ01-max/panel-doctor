"""
패널 추출 시스템 백엔드 애플리케이션
"""
from flask import Flask
from flask_cors import CORS


def create_app():
    """Flask 애플리케이션 팩토리"""
    app = Flask(__name__)
    
    # 설정 로드
    app.config.from_object('app.config')
    
    # CORS 설정 (프론트 개발 서버 접근 허용)
    # 허용 오리진은 환경설정의 CORS_ORIGINS를 사용
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config.get('CORS_ORIGINS', ['http://localhost:5173'])}},
        supports_credentials=False,
    )
    
    # 데이터베이스 초기화
    from app.db import init_db
    init_db(app)
    
    # 라우트 등록
    from app.routes import search_routes
    app.register_blueprint(search_routes.bp)
    
    return app
