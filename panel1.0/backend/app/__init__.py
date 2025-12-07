"""
패널 추출 시스템 백엔드 애플리케이션
"""
from flask import Flask
from flask_cors import CORS
from app.config import Config


def create_app():
    """Flask 애플리케이션 팩토리"""
    app = Flask(__name__)
    
    # 설정 로드 (CORS 설정 전에 필요)
    app.config.from_object('app.config')
    
    # CORS 설정: 환경설정의 CORS_ORIGINS 값을 사용 (쉼표로 분리된 목록)
    # 프로덕션 환경의 ALB 주소도 포함
    cors_origins = list(Config.CORS_ORIGINS) + [
        "http://capstone-front-back-nlb-5df2d37f3e3da2a2.elb.ap-northeast-2.amazonaws.com",
        "http://capstone-alb-528635803.ap-northeast-2.elb.amazonaws.com"
    ]
    
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": cors_origins
            }
        },
        supports_credentials=False,
    )

    
    # 데이터베이스 초기화
    from app.db import init_db
    init_db(app)
    
    # Singleton 서비스 초기화 (서버 시작 시 1회만)
    # LlmService와 VectorSearchService를 미리 초기화하여 첫 요청 시 지연 방지
    print("[INFO] Singleton 서비스 초기화 시작...")
    try:
        from app.services.llm.client import LlmService
        from app.services.data.vector import VectorSearchService
        
        # LlmService 초기화 (서버 시작 시 1회만)
        llm_service = LlmService()
        print("[INFO] LlmService Singleton 초기화 완료")
        
        # VectorSearchService는 필요할 때만 초기화 (임베딩 모델 로딩은 무거움)
        # 첫 semantic/hybrid 검색 요청 시 자동으로 초기화됨
        print("[INFO] VectorSearchService는 첫 semantic 검색 요청 시 초기화됩니다")
    except Exception as e:
        print(f"[WARN] Singleton 서비스 초기화 중 오류 (무시 가능): {e}")
        import traceback
        traceback.print_exc()
    
    # 라우트 등록
    # 1. 통합 검색 엔드포인트 (SearchService 기반)
    #    - /api/search: 자연어 질의 → 자동 전략 선택 → 검색 실행
    from app.routes import search as search_route
    app.register_blueprint(search_route.bp)
    from app.routes import semantic_search_routes
    app.register_blueprint(semantic_search_routes.bp)
    
    # 2. 패널 대시보드 및 도구 라우트 (PanelDataService 기반)
    #    - /api/panel/dashboard: 대시보드 데이터 (캐싱)
    #    - /api/tools/*: 개발/디버깅용 도구
    from app.routes import search_routes
    app.register_blueprint(search_routes.bp)  # /api/panel/dashboard
    app.register_blueprint(search_routes.tools_bp)  # /api/tools/*
    
    # LLM 관련 라우트 (sql_search, ask, models 등)
    from app.routes import llm_routes
    app.register_blueprint(llm_routes.bp)
    
    # 타겟 그룹 라우트
    from app.routes import target_group_routes
    app.register_blueprint(target_group_routes.bp)
    
    # 데이터 소스 라우트
    from app.routes import data_source_routes
    app.register_blueprint(data_source_routes.bp)
    
    # 내보내기 라우트
    from app.routes import export_routes
    app.register_blueprint(export_routes.bp)
    
    return app
