"""
패널 대시보드 및 도구 라우트 (PanelDataService 기반)
- /api/panel/dashboard: 패널 대시보드 데이터 조회 (캐싱 적용)
- /api/tools/*: 개발/디버깅용 도구 엔드포인트
- 주의: search.py와는 다른 역할 (search.py는 통합 검색용)
"""
from flask import Blueprint, request, jsonify
from app.services.data.panel import PanelDataService
from app.services.data.executor import execute_sql_safe
from app.config import Config
import traceback
import time


bp = Blueprint('panel_search', __name__, url_prefix='/api/panel')

# 인메모리 캐시 (모듈 레벨 변수)
_dashboard_cache = {
    'data': None,
    'timestamp': None
}
CACHE_TTL = 86400  # 24시간 (1일, 초 단위)


@bp.route('/dashboard', methods=['GET'])
def get_dashboard():
    """대시보드 데이터 조회 (인메모리 캐싱 적용)"""
    global _dashboard_cache
    
    try:
        current_time = time.time()
        
        # 캐시가 유효한지 확인 (24시간 이내)
        if (_dashboard_cache['data'] is not None and 
            _dashboard_cache['timestamp'] is not None and
            (current_time - _dashboard_cache['timestamp']) < CACHE_TTL):
            cache_age_seconds = int(current_time - _dashboard_cache['timestamp'])
            cache_age_hours = cache_age_seconds // 3600
            cache_age_minutes = (cache_age_seconds % 3600) // 60
            print(f"[CACHE] 대시보드 데이터 캐시 히트 (캐시 나이: {cache_age_hours}시간 {cache_age_minutes}분)")
            return jsonify(_dashboard_cache['data']), 200
        
        # 캐시가 없거나 만료된 경우 새로 계산
        print("[CACHE] 대시보드 데이터 새로 계산 및 캐시 업데이트")
        service = PanelDataService()
        dashboard_data = service.get_dashboard_data()
        
        # 캐시 업데이트
        _dashboard_cache['data'] = dashboard_data
        _dashboard_cache['timestamp'] = current_time
        
        return jsonify(dashboard_data), 200
        
    except Exception as e:
        print(f"[ERROR] 대시보드 데이터 조회 오류: {e}")
        print(f"[ERROR] 트레이스백: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


# 공용 툴 엔드포인트 (LLM이 프록시로 호출)
tools_bp = Blueprint('tools', __name__, url_prefix='/api/tools')


@tools_bp.route('/ping', methods=['GET'])
def tool_ping():
    return jsonify({"ok": True, "message": "tools blueprint alive"}), 200


@tools_bp.route('/execute_sql', methods=['POST'])
def tool_execute_sql():
    try:
        data = request.get_json(force=True) or {}
        query = data.get('query', '')
        params = data.get('params', {})
        limit = int(data.get('limit', 200))
        timeout_ms = int(data.get('statement_timeout_ms', 5000))

        rows = execute_sql_safe(query=query, params=params, limit=limit, statement_timeout_ms=timeout_ms)
        return jsonify({
            'rows': rows,
            'count': len(rows),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e), 'type': type(e).__name__, 'traceback': traceback.format_exc()}), 400


@tools_bp.route('/db_config', methods=['GET'])
def tool_db_config():
    try:
        return jsonify(Config.get_db_config()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/health', methods=['GET'])
def get_health():
    """데이터 품질 진단 데이터 조회"""
    try:
        service = PanelDataService()
        health_data = service.get_health_data()
        return jsonify(health_data), 200
    except Exception as e:
        print(f"[ERROR] 데이터 품질 진단 오류: {e}")
        print(f"[ERROR] 트레이스백: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@tools_bp.route('/db_schema', methods=['GET'])
def tool_db_schema():
    """DB 스키마 및 테이블별 상세 정보 조회 (모든 스키마 포함)"""
    try:
        # 모든 스키마의 테이블 목록 조회 (public, core, staging 등)
        tables = execute_sql_safe(
            query=(
                "SELECT t.table_schema, t.table_name, "
                "(SELECT COUNT(*) FROM information_schema.columns "
                " WHERE table_schema=t.table_schema AND table_name=t.table_name) AS column_count, "
                "COALESCE((SELECT COUNT(*) FROM information_schema.table_constraints "
                " WHERE table_schema=t.table_schema AND table_name=t.table_name "
                " AND constraint_type='PRIMARY KEY'), 0) AS has_pk "
                "FROM information_schema.tables t "
                "WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast') "
                "  AND t.table_type='BASE TABLE' "
                "ORDER BY t.table_schema, t.table_name"
            ),
            limit=100,
        )
        
        result = {
            'tables': [],
        }
        
        for tbl in tables:
            schema_name = tbl['table_schema']
            tbl_name = tbl['table_name']
            full_table_name = f"{schema_name}.{tbl_name}"
            
            try:
                # 실제 데이터 건수 (스키마 포함)
                count_row = execute_sql_safe(
                    query=f'SELECT COUNT(*) AS cnt FROM "{schema_name}"."{tbl_name}"',
                    limit=1,
                )
                row_count = int(count_row[0]['cnt']) if count_row else 0
                
                # 컬럼 목록
                cols = execute_sql_safe(
                    query=(
                        "SELECT column_name, data_type, is_nullable "
                        "FROM information_schema.columns "
                        "WHERE table_schema=%(schema)s AND table_name=%(tbl)s "
                        "ORDER BY ordinal_position"
                    ),
                    params={"schema": schema_name, "tbl": tbl_name},
                    limit=200,
                )
                
                result['tables'].append({
                    'schema': schema_name,
                    'name': tbl_name,
                    'full_name': full_table_name,
                    'row_count': row_count,
                    'column_count': int(tbl.get('column_count', 0)),
                    'has_pk': bool(tbl.get('has_pk', 0)),
                    'columns': cols,
                })
            except Exception as e:
                result['tables'].append({
                    'schema': schema_name,
                    'name': tbl_name,
                    'full_name': full_table_name,
                    'row_count': None,
                    'error': str(e),
                })
        
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
