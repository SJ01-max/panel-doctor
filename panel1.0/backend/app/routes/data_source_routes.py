"""
데이터 소스 관리 API 라우트
- 실제 DB 통계 정보 조회
- 테이블 스키마 정보 조회
- 데이터 소스 현황 조회
"""
from flask import Blueprint, jsonify
from app.services.data.executor import execute_sql_safe
from app.db.connection import get_db_connection, return_db_connection
import traceback
from datetime import datetime


bp = Blueprint('data_source', __name__, url_prefix='/api/data-sources')


@bp.route('/stats', methods=['GET'])
def get_data_source_stats():
    """
    데이터 소스 통계 정보 조회
    
    응답:
    {
        "totalFiles": 35,
        "totalQuestions": 612,
        "totalPanels": 23017,
        "lastUpdated": "2025-01-14 10:24"
    }
    """
    try:
        # core_v2.respondent 테이블의 총 패널 수
        respondent_count = 0
        try:
            result = execute_sql_safe(
                query='SELECT COUNT(*) as count FROM "core_v2"."respondent"',
                params=None,
                limit=1
            )
            respondent_count = int(result[0]['count']) if result and len(result) > 0 else 0
        except Exception as e:
            print(f"[WARN] respondent 테이블 조회 실패: {e}")
        
        # core_v2.response 테이블의 총 응답 수 (문항 수 대신)
        response_count = 0
        try:
            result = execute_sql_safe(
                query='SELECT COUNT(*) as count FROM "core_v2"."response"',
                params=None,
                limit=1
            )
            response_count = int(result[0]['count']) if result and len(result) > 0 else 0
        except Exception as e:
            print(f"[WARN] response 테이블 조회 실패: {e}")
        
        # 총 문항 수: 62개
        question_count = 62
        
        # 마지막 업데이트 시간 (respondent 테이블의 최신 데이터 기준)
        last_updated = None
        try:
            # updated_at 또는 created_at 컬럼이 있으면 사용, 없으면 현재 시간
            result = execute_sql_safe(
                query='SELECT MAX(created_at) as last_updated FROM "core_v2"."respondent" WHERE created_at IS NOT NULL',
                params=None,
                limit=1
            )
            if result and result[0].get('last_updated'):
                last_updated = result[0]['last_updated']
                if isinstance(last_updated, datetime):
                    last_updated = last_updated.strftime('%Y-%m-%d %H:%M')
        except Exception as e:
            print(f"[WARN] 마지막 업데이트 시간 조회 실패: {e}")
        
        # 파일 수: 엑셀 파일 35개 + welcome 1, 2 = 37개
        # 실제 파일 추적 시스템이 있다면 별도 테이블에서 조회
        total_files = 37
        
        return jsonify({
            'totalFiles': total_files,
            'totalQuestions': question_count,
            'totalPanels': respondent_count,
            'lastUpdated': last_updated or datetime.now().strftime('%Y-%m-%d %H:%M')
        }), 200
        
    except Exception as e:
        print(f"[ERROR] 데이터 소스 통계 조회 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': '데이터 소스 통계를 불러오는데 실패했습니다.'
        }), 500


@bp.route('/tables', methods=['GET'])
def get_data_source_tables():
    """
    데이터 소스 테이블 목록 조회 (스키마 정보 포함)
    
    응답:
    {
        "tables": [
            {
                "name": "respondent",
                "schema": "core_v2",
                "rows": 23017,
                "columns": 5,
                "status": "success"
            }
        ]
    }
    """
    try:
        # core_v2 스키마의 주요 테이블들 조회
        tables_to_check = [
            ('core_v2', 'respondent'),
            ('core_v2', 'response'),
            ('core_v2', 'respondent_json'),
            ('core_v2', 'panel_embedding'),
        ]
        
        result_tables = []
        
        for schema, table_name in tables_to_check:
            try:
                # 행 수 조회
                count_result = execute_sql_safe(
                    query=f'SELECT COUNT(*) as count FROM "{schema}"."{table_name}"',
                    params=None,
                    limit=1
                )
                row_count = int(count_result[0]['count']) if count_result and len(count_result) > 0 else 0
                
                # 컬럼 수 조회
                col_result = execute_sql_safe(
                    query="""
                        SELECT COUNT(*) as count
                        FROM information_schema.columns
                        WHERE table_schema = %(schema)s AND table_name = %(table_name)s
                    """,
                    params={'schema': schema, 'table_name': table_name},
                    limit=1
                )
                col_count = int(col_result[0]['count']) if col_result and len(col_result) > 0 else 0
                
                # 컬럼 목록 조회
                columns_result = execute_sql_safe(
                    query="""
                        SELECT column_name, data_type
                        FROM information_schema.columns
                        WHERE table_schema = %(schema)s AND table_name = %(table_name)s
                        ORDER BY ordinal_position
                    """,
                    params={'schema': schema, 'table_name': table_name},
                    limit=50
                )
                columns = [col['column_name'] for col in columns_result] if columns_result else []
                
                result_tables.append({
                    'name': table_name,
                    'schema': schema,
                    'rows': row_count,
                    'columns': col_count,
                    'columnNames': columns,
                    'status': 'success' if row_count > 0 else 'empty'
                })
            except Exception as e:
                result_tables.append({
                    'name': table_name,
                    'schema': schema,
                    'rows': 0,
                    'columns': 0,
                    'columnNames': [],
                    'status': 'error',
                    'error': str(e)
                })
        
        return jsonify({
            'tables': result_tables
        }), 200
        
    except Exception as e:
        print(f"[ERROR] 테이블 목록 조회 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': '테이블 목록을 불러오는데 실패했습니다.'
        }), 500


@bp.route('/schema', methods=['GET'])
def get_schema_info():
    """
    스키마 맵 정보 조회
    
    응답:
    {
        "schemas": [
            {
                "table": "panel.respondent",
                "fields": ["respondent_id", "gender", "birth_year", "region"]
            }
        ]
    }
    """
    try:
        schemas = []
        
        # core_v2.respondent
        try:
            result = execute_sql_safe(
                query="""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'core_v2' AND table_name = 'respondent'
                    ORDER BY ordinal_position
                """,
                params=None,
                limit=20
            )
            respondent_fields = [row['column_name'] for row in result] if result else []
            schemas.append({
                'table': 'panel.respondent',
                'fields': respondent_fields
            })
        except Exception as e:
            print(f"[WARN] respondent 스키마 조회 실패: {e}")
            schemas.append({
                'table': 'panel.respondent',
                'fields': ['respondent_id', 'gender', 'birth_year', 'region']
            })
        
        # core_v2.response
        try:
            result = execute_sql_safe(
                query="""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'core_v2' AND table_name = 'response'
                    ORDER BY ordinal_position
                """,
                params=None,
                limit=20
            )
            response_fields = [row['column_name'] for row in result] if result else []
            schemas.append({
                'table': 'panel.response',
                'fields': response_fields
            })
        except Exception as e:
            print(f"[WARN] response 스키마 조회 실패: {e}")
            schemas.append({
                'table': 'panel.response',
                'fields': ['respondent_id', 'question_id', 'answer']
            })
        
        # core_v2.respondent_json (question과 유사)
        try:
            result = execute_sql_safe(
                query="""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'core_v2' AND table_name = 'respondent_json'
                    ORDER BY ordinal_position
                """,
                params=None,
                limit=20
            )
            json_fields = [row['column_name'] for row in result] if result else []
            schemas.append({
                'table': 'panel.question',
                'fields': json_fields[:5] if json_fields else ['question_id', 'q_text', 'q_type']
            })
        except Exception as e:
            print(f"[WARN] respondent_json 스키마 조회 실패: {e}")
            schemas.append({
                'table': 'panel.question',
                'fields': ['question_id', 'q_text', 'q_type']
            })
        
        return jsonify({
            'schemas': schemas
        }), 200
        
    except Exception as e:
        print(f"[ERROR] 스키마 정보 조회 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': '스키마 정보를 불러오는데 실패했습니다.'
        }), 500


@bp.route('/errors', methods=['GET'])
def get_error_logs():
    """
    에러 로그 조회 (현재는 빈 배열 반환 - 실제 에러 로그 시스템이 없음)
    
    응답:
    {
        "errors": []
    }
    """
    try:
        # 실제 에러 로그 테이블이 있다면 여기서 조회
        # 현재는 빈 배열 반환
        return jsonify({
            'errors': []
        }), 200
        
    except Exception as e:
        print(f"[ERROR] 에러 로그 조회 실패: {e}")
        return jsonify({
            'error': str(e),
            'errors': []
        }), 200


@bp.route('/tables/<schema>/<table_name>/preview', methods=['GET'])
def get_table_preview(schema: str, table_name: str):
    """
    테이블 미리보기 데이터 조회
    
    파라미터:
    - schema: 테이블 스키마 (예: core_v2)
    - table_name: 테이블 이름 (예: respondent)
    - limit: 조회할 행 수 (기본값: 100, 최대: 500)
    
    응답:
    {
        "schema": "core_v2",
        "table": "respondent",
        "columns": ["respondent_id", "gender", "birth_year", ...],
        "rows": [
            {"respondent_id": "1", "gender": "남", ...},
            ...
        ],
        "totalRows": 23017,
        "previewedRows": 100
    }
    """
    try:
        from flask import request
        
        # limit 파라미터 (기본값 100, 최대 500)
        limit = request.args.get('limit', 100, type=int)
        limit = min(max(limit, 1), 500)  # 1~500 사이로 제한
        
        # SQL 인젝션 방지: 스키마와 테이블명 검증
        if not schema.replace('_', '').replace('-', '').isalnum():
            return jsonify({'error': 'Invalid schema name'}), 400
        if not table_name.replace('_', '').replace('-', '').isalnum():
            return jsonify({'error': 'Invalid table name'}), 400
        
        # 컬럼 목록 조회
        columns_result = execute_sql_safe(
            query="""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = %(schema)s AND table_name = %(table_name)s
                ORDER BY ordinal_position
            """,
            params={'schema': schema, 'table_name': table_name},
            limit=100
        )
        
        if not columns_result:
            return jsonify({'error': f'Table {schema}.{table_name} not found'}), 404
        
        columns = [col['column_name'] for col in columns_result]
        
        # 전체 행 수 조회
        count_result = execute_sql_safe(
            query=f'SELECT COUNT(*) as count FROM "{schema}"."{table_name}"',
            params=None,
            limit=1
        )
        total_rows = int(count_result[0]['count']) if count_result and len(count_result) > 0 else 0
        
        # 샘플 데이터 조회
        preview_result = execute_sql_safe(
            query=f'SELECT * FROM "{schema}"."{table_name}" LIMIT %(limit)s',
            params={'limit': limit},
            limit=limit
        )
        
        return jsonify({
            'schema': schema,
            'table': table_name,
            'columns': columns,
            'rows': preview_result or [],
            'totalRows': total_rows,
            'previewedRows': len(preview_result) if preview_result else 0
        }), 200
        
    except Exception as e:
        print(f"[ERROR] 테이블 미리보기 조회 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': f'테이블 {schema}.{table_name} 미리보기를 불러오는데 실패했습니다.'
        }), 500


@bp.route('/history', methods=['GET'])
def get_load_history():
    """
    적재 이력 조회 (현재는 빈 배열 반환 - 실제 적재 이력 시스템이 없음)
    
    응답:
    {
        "history": []
    }
    """
    try:
        # 실제 적재 이력 테이블이 있다면 여기서 조회
        # 현재는 빈 배열 반환
        return jsonify({
            'history': []
        }), 200
        
    except Exception as e:
        print(f"[ERROR] 적재 이력 조회 실패: {e}")
        return jsonify({
            'error': str(e),
            'history': []
        }), 200

