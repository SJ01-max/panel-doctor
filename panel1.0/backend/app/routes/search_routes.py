"""
패널 대시보드 및 도구 라우트 (PanelDataService 기반)
- /api/panel/dashboard: 패널 대시보드 데이터 조회 (캐싱 적용)
- /api/panel/export: 패널 검색 결과 전체 내보내기 (CSV)
- /api/tools/*: 개발/디버깅용 도구 엔드포인트
- 주의: search.py와는 다른 역할 (search.py는 통합 검색용)
"""
from flask import Blueprint, request, jsonify, Response, stream_with_context
from app.services.data.panel import PanelDataService
from app.services.data.executor import execute_sql_safe
from app.services.search.service import SearchService
from app.config import Config
import traceback
import time
import csv
import io


bp = Blueprint('panel_search', __name__, url_prefix='/api/panel')

# 인메모리 캐시 (모듈 레벨 변수)
_dashboard_cache = {
    'data': None,
    'timestamp': None
}
CACHE_TTL = 86400  # 24시간 (1일, 초 단위)

def clear_dashboard_cache():
    """대시보드 캐시 초기화 (개발/테스트용)"""
    global _dashboard_cache
    _dashboard_cache = {
        'data': None,
        'timestamp': None
    }


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


@bp.route('/dashboard/clear-cache', methods=['POST'])
def clear_dashboard_cache_endpoint():
    """대시보드 캐시 초기화 (개발/테스트용)"""
    try:
        clear_dashboard_cache()
        print("[CACHE] 대시보드 캐시 초기화 완료")
        return jsonify({'message': '캐시가 초기화되었습니다.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/export', methods=['GET'])
def export_panels():
    """
    패널 검색 결과 전체 내보내기 (CSV)
    
    Query Parameters:
        - q: 검색 쿼리 (자연어)
        - model: LLM 모델 (선택사항)
    
    Returns:
        CSV 파일 (스트리밍 응답)
    """
    try:
        query = request.args.get('q', '').strip()
        model = request.args.get('model', None)
        
        if not query:
            return jsonify({
                'error': 'query가 필요합니다.',
                'message': '검색 쿼리를 입력해주세요.'
            }), 400
        
        print(f"[INFO] 패널 내보내기 시작: query='{query}'")
        
        # 통합 검색 서비스 실행 (LIMIT 없이)
        search_service = SearchService()
        result = search_service.search(user_query=query, model=model, min_results=0)
        
        results = result.get('results', [])
        total_count = result.get('total_count', len(results))
        
        print(f"[INFO] 내보내기 대상: {total_count}개 (반환된 결과: {len(results)}개)")
        
        # LIMIT 없이 전체 데이터 조회
        # 이미 검색 결과가 있지만, 전체를 가져오기 위해 다시 검색 실행
        # 또는 기존 결과를 사용 (LIMIT이 적용되지 않은 경우)
        
        # 전체 데이터를 가져오기 위해 LIMIT을 매우 크게 설정하여 재검색
        # 또는 기존 검색 로직을 재사용하되 LIMIT 없이
        filters = result.get('filters_applied', {})
        semantic_keywords = result.get('keywords_used', [])
        strategy = result.get('selected_strategy', 'filter_first')
        # 의미 기반 검색의 경우 search_text를 사용해야 함
        # parsed_query에서 search_text 추출 (LLM이 생성한 풍부한 설명 문장)
        parsed_query = result.get('parsed_query', {})
        search_text = parsed_query.get('search_text') or result.get('search_text_used') or result.get('search_text')
        
        # 전략에 따라 전체 데이터 조회
        if strategy == 'filter_first':
            from app.services.search.strategy.filter_first import FilterFirstSearch
            search_strategy = FilterFirstSearch()
            full_result = search_strategy.search(filters=filters, limit=50000)  # 매우 큰 LIMIT
        elif strategy == 'semantic_first':
            from app.services.search.strategy.semantic_first import SemanticFirstSearch
            search_strategy = SemanticFirstSearch()
            # ★ search_text를 사용하여 의미 기반 검색 실행
            if search_text:
                full_result = search_strategy.search(search_text=search_text, limit=50000)
            else:
                # search_text가 없으면 semantic_keywords 사용 (하위 호환성)
                full_result = search_strategy.search(semantic_keywords=semantic_keywords, limit=50000)
        elif strategy == 'hybrid':
            from app.services.search.strategy.hybrid import HybridSearch
            search_strategy = HybridSearch()
            # ★ search_text를 사용하여 하이브리드 검색 실행
            if search_text:
                full_result = search_strategy.search(filters=filters, search_text=search_text, limit=50000)
            else:
                full_result = search_strategy.search(filters=filters, semantic_keywords=semantic_keywords, limit=50000)
        else:
            full_result = {'results': results}
        
        export_results = full_result.get('results', results)
        
        # 결과가 비어있으면 원래 검색 결과 사용 (fallback)
        if not export_results or len(export_results) == 0:
            export_results = results
            print(f"[WARN] 재검색 결과가 비어있어 원래 검색 결과 사용: {len(results)}개")
        
        print(f"[INFO] 내보내기 데이터 준비 완료: {len(export_results)}개")
        
        # CSV 생성 (스트리밍)
        def generate_csv():
            # BOM 추가 (Excel에서 한글 깨짐 방지)
            yield '\ufeff'
            
            # CSV Writer 생성
            output = io.StringIO()
            writer = csv.writer(output)
            
            # 헤더 작성
            if export_results and len(export_results) > 0:
                # 첫 번째 결과에서 키 추출
                headers = ['respondent_id', 'gender', 'age', 'region', 'birth_year']
                # json_doc이 있으면 추가
                if 'json_doc' in export_results[0] or 'content' in export_results[0]:
                    headers.append('content')
                
                writer.writerow(headers)
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)
                
                # 데이터 행 작성
                for row in export_results:
                    # 나이 계산
                    age = None
                    if 'birth_year' in row and row['birth_year']:
                        from datetime import datetime
                        current_year = datetime.now().year
                        age = current_year - row['birth_year']
                    
                    csv_row = [
                        row.get('respondent_id', ''),
                        row.get('gender', ''),
                        age if age is not None else '',
                        row.get('region', ''),
                        row.get('birth_year', ''),
                    ]
                    
                    # content 추가
                    content = row.get('json_doc') or row.get('content', '')
                    if content:
                        # JSON 문자열을 CSV에 안전하게 포함
                        csv_row.append(str(content).replace('\n', ' ').replace('\r', ' '))
                    else:
                        csv_row.append('')
                    
                    writer.writerow(csv_row)
                    yield output.getvalue()
                    output.seek(0)
                    output.truncate(0)
            else:
                # 결과가 없을 때
                writer.writerow(['respondent_id', 'gender', 'age', 'region', 'birth_year', 'content'])
                yield output.getvalue()
        
        # 파일명 생성
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"panel_export_{timestamp}.csv"
        
        print(f"[INFO] CSV 파일 생성 완료: {filename}")
        
        return Response(
            stream_with_context(generate_csv()),
            mimetype='text/csv; charset=utf-8',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'text/csv; charset=utf-8'
            }
        )
        
    except Exception as e:
        print(f"[ERROR] 패널 내보내기 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'type': type(e).__name__
        }), 500


@bp.route('/detail/<respondent_id>', methods=['GET'])
def get_panel_detail(respondent_id: str):
    """
    패널 상세 정보 조회 (respondent_summary_json 기반)
    
    Args:
        respondent_id: 패널 ID
    
    Returns:
        패널 상세 정보 (기본 정보 + 정리된 JSON 문서)
    """
    try:
        # 기본 정보 조회 (core_v2.respondent)
        basic_info = execute_sql_safe(
            query="""
                SELECT 
                    respondent_id,
                    gender,
                    birth_year,
                    region,
                    district
                FROM core_v2.respondent
                WHERE respondent_id = %(respondent_id)s
            """,
            params={'respondent_id': respondent_id},
            limit=1
        )
        
        if not basic_info or len(basic_info) == 0:
            return jsonify({'error': '패널을 찾을 수 없습니다.'}), 404
        
        basic = basic_info[0]
        
        # 나이 계산
        from datetime import datetime
        current_year = datetime.now().year
        birth_year = basic.get('birth_year')
        age = None
        age_text = None
        if birth_year:
            age = current_year - birth_year
            age_text = f"만 {age}세"
        
        # 정리된 JSON 문서 조회 (여러 가능한 테이블/컬럼명 시도)
        json_content = None
        import json as json_module
        
        # 가능한 테이블/컬럼 조합 시도
        possible_queries = [
            # 1. respondent_summary_json.summary_json
            ("core_v2.respondent_summary_json", "summary_json"),
            # 2. respondent_summary_json.json_doc
            ("core_v2.respondent_summary_json", "json_doc"),
            # 3. respondent_summary.summary_json
            ("core_v2.respondent_summary", "summary_json"),
            # 4. fallback: respondent_json.json_doc
            ("core_v2.respondent_json", "json_doc"),
        ]
        
        for table_name, column_name in possible_queries:
            try:
                result = execute_sql_safe(
                    query=f"""
                        SELECT 
                            respondent_id,
                            {column_name}
                        FROM {table_name}
                        WHERE respondent_id = %(respondent_id)s
                    """,
                    params={'respondent_id': respondent_id},
                    limit=1
                )
                
                if result and len(result) > 0:
                    json_content = result[0].get(column_name)
                    if json_content:
                        # JSON 문자열인 경우 파싱 시도
                        if isinstance(json_content, str):
                            try:
                                json_content = json_module.loads(json_content)
                            except Exception as parse_err:
                                print(f"[WARN] {table_name}.{column_name} 파싱 실패: {parse_err}")
                                # 파싱 실패해도 문자열 그대로 사용
                        print(f"[INFO] {table_name}.{column_name}에서 데이터 조회 성공")
                        break  # 성공하면 루프 종료
            except Exception as e:
                print(f"[DEBUG] {table_name}.{column_name} 조회 실패 (무시): {e}")
                continue  # 다음 조합 시도
        
        result = {
            'respondent_id': basic.get('respondent_id'),
            'gender': basic.get('gender', '-'),
            'birth_year': birth_year,
            'age': age,
            'age_text': age_text,
            'region': basic.get('region', '-'),
            'district': basic.get('district', '-'),
            'json_doc': json_content,
            'last_response_date': None  # TODO: 실제 응답일 정보가 있으면 추가
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"[ERROR] 패널 상세 정보 조회 오류: {e}")
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
