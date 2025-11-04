"""패널 검색 관련 라우트"""
from flask import Blueprint, request, jsonify
from app.services.query_parser import QueryParser
from app.services.panel_service import PanelService


bp = Blueprint('search', __name__, url_prefix='/api/panel')


@bp.route('/search', methods=['POST'])
def search_panels():
    """자연어 질의로 패널 검색"""
    try:
        data = request.get_json()
        query_text = data.get('query', '')
        
        if not query_text:
            return jsonify({'error': '질의 텍스트가 필요합니다.'}), 400
        
        # 자연어 질의 파싱
        parser = QueryParser()
        parsed_query = parser.parse(query_text)
        
        # 패널 검색
        service = PanelService()
        results = service.search(parsed_query)
        
        return jsonify(results), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/dashboard', methods=['GET'])
def get_dashboard():
    """대시보드 데이터 조회"""
    try:
        service = PanelService()
        dashboard_data = service.get_dashboard_data()
        
        return jsonify(dashboard_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
