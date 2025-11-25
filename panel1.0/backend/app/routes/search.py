"""
통합 검색 엔드포인트 (SearchService 기반)
- /api/search: 자연어 질의를 받아 자동으로 전략 선택 및 검색 실행
- SearchService를 사용하여 filter_first, semantic_first, hybrid 전략 자동 선택
- 주의: search_routes.py와는 다른 역할 (search_routes.py는 패널 대시보드/도구용)
"""
from flask import Blueprint, request, jsonify
from app.services.search.service import SearchService
import time

bp = Blueprint('search', __name__, url_prefix='/api')
search_service = SearchService()

@bp.route('/search', methods=['POST'])
def search():
    """
    통합 검색 엔드포인트
    
    요청:
    {
        "query": "서울 20대 남자 100명",
        "model": "claude-sonnet-4-5" (선택사항)
    }
    
    응답:
    {
        "results": [...],
        "count": 100,
        "strategy": "filter_first" | "semantic_first" | "hybrid",
        "parsed_query": {...},
        "selected_strategy": "...",
        "strategy_info": {...}
    }
    """
    
    t0 = time.perf_counter()
    
    try:
        data = request.get_json(force=True) or {}
        query = data.get('query', '').strip()
        model = data.get('model', None)
        
        if not query:
            return jsonify({
                'error': 'query가 필요합니다.',
                'message': '자연어 질의를 입력해주세요.'
            }), 400
        
        t1 = time.perf_counter()
        result = search_service.search(user_query=query, model=model)
        t2 = time.perf_counter()
        
        # 통합 검색 서비스 실행
        #search_service = SearchService()
        result = search_service.search(user_query=query, model=model)
        
        return jsonify(result), 200
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] 검색 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{error_trace}")
        return jsonify({
            'error': str(e),
            'type': type(e).__name__
        }), 500

