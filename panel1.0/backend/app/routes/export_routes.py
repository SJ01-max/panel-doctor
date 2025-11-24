"""
내보내기 API 라우트
"""
from flask import Blueprint, request, jsonify, send_file
from app.services.data.export_history import ExportHistoryService
from app.services.data.target_group import TargetGroupService
from app.services.data.sql_builder import SQLBuilder
from app.services.data.executor import execute_sql_safe
from app.utils.file_generator import generate_csv, generate_excel, generate_pdf
from app.utils.calculate_panel_count import calculate_panel_count
import traceback
import os
from datetime import datetime


bp = Blueprint('exports', __name__, url_prefix='/api/exports')


@bp.route('', methods=['GET'])
def get_export_history():
    """
    내보내기 이력 조회 (필터링 지원)
    
    쿼리 파라미터:
    - period: 기간 (7, 30, 90, all)
    - file_type: 파일 유형 (csv, excel, pdf, all)
    - status: 상태 (success, failed, processing, all)
    - search: 검색어 (파일명, 설명)
    - limit: 페이지 크기 (기본값: 100)
    - offset: 오프셋 (기본값: 0)
    """
    try:
        service = ExportHistoryService()
        
        # 쿼리 파라미터
        period = request.args.get('period', 'all')
        file_type = request.args.get('file_type', 'all')
        status = request.args.get('status', 'all')
        search = request.args.get('search', '')
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        
        # 기간 변환
        period_days = None
        if period != 'all':
            try:
                period_days = int(period)
            except:
                pass
        
        # 이력 조회
        history = service.get_all(
            limit=limit,
            offset=offset,
            period_days=period_days,
            file_type=file_type,
            status=status,
            search_query=search
        )
        
        return jsonify({
            'history': history,
            'total': len(history)
        }), 200
        
    except Exception as e:
        print(f"[ERROR] 내보내기 이력 조회 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': '내보내기 이력을 불러오는데 실패했습니다.'
        }), 500


@bp.route('/stats', methods=['GET'])
def get_export_stats():
    """내보내기 통계 조회"""
    try:
        service = ExportHistoryService()
        stats = service.get_stats()
        
        return jsonify(stats), 200
        
    except Exception as e:
        print(f"[ERROR] 내보내기 통계 조회 실패: {e}")
        return jsonify({
            'error': str(e),
            'message': '통계를 불러오는데 실패했습니다.'
        }), 500


@bp.route('', methods=['POST'])
def create_export():
    """
    새 내보내기 생성
    
    요청:
    {
        "export_type": "target_group" | "panel_search" | "report",
        "file_type": "csv" | "excel" | "pdf",
        "target_group_id": 1,  // 타겟 그룹 내보내기인 경우
        "filters": {...},  // 패널 검색 내보내기인 경우
        "description": "설명"
    }
    """
    try:
        service = ExportHistoryService()
        data = request.get_json(force=True) or {}
        
        export_type = data.get('export_type')
        file_type = data.get('file_type', 'csv')
        
        if not export_type:
            return jsonify({
                'error': 'export_type 필드가 필요합니다.'
            }), 400
        
        # 내보내기 데이터 조회 및 파일 생성
        export_data = []
        panel_count = 0
        file_name = None
        description = data.get('description', '')
        
        if export_type == 'target_group':
            # 타겟 그룹 내보내기
            target_group_id = data.get('target_group_id')
            if not target_group_id:
                return jsonify({
                    'error': 'target_group_id 필드가 필요합니다.'
                }), 400
            
            tg_service = TargetGroupService()
            group = tg_service.get_by_id(target_group_id)
            if not group:
                return jsonify({
                    'error': '타겟 그룹을 찾을 수 없습니다.'
                }), 404
            
            # 타겟 그룹 조건으로 패널 데이터 조회
            filters = group.get('filters', {})
            if isinstance(filters, str):
                import json
                filters = json.loads(filters)
            
            age_range = filters.get('age_range')
            gender = filters.get('gender')
            region = filters.get('region')
            
            # SQL 쿼리로 패널 데이터 조회
            export_data = SQLBuilder.execute_filter_query(
                filters={
                    'age_range': age_range,
                    'gender': gender,
                    'region': region
                },
                limit=10000
            )
            
            panel_count = len(export_data)
            file_name = f"target_group_{group['name']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            description = description or f"타겟 그룹: {group['name']}"
        
        elif export_type == 'panel_search':
            # 패널 검색 결과 내보내기
            filters = data.get('filters', {})
            
            export_data = SQLBuilder.execute_filter_query(
                filters=filters,
                limit=10000
            )
            
            panel_count = len(export_data)
            file_name = f"panel_search_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            description = description or "패널 검색 결과"
        
        else:
            return jsonify({
                'error': f'지원하지 않는 export_type: {export_type}'
            }), 400
        
        # 내보내기 이력 생성
        export_id = service.create(
            file_name=file_name,
            file_type=file_type,
            export_type=export_type,
            panel_count=panel_count,
            description=description,
            metadata=data.get('metadata', {}),
            created_by=data.get('created_by')
        )
        
        # 파일 생성 (비동기로 처리하는 것이 좋지만, 일단 동기로 처리)
        try:
            if file_type == 'csv':
                file_path, file_size = generate_csv(export_data, file_name)
            elif file_type == 'excel':
                file_path, file_size = generate_excel(export_data, file_name)
            elif file_type == 'pdf':
                file_path, file_size = generate_pdf(export_data, file_name, title=description)
            else:
                raise ValueError(f'지원하지 않는 file_type: {file_type}')
            
            # 상태 업데이트
            service.update_status(
                export_id=export_id,
                status='success',
                file_path=file_path,
                file_size=file_size
            )
            
            return jsonify({
                'id': export_id,
                'file_name': f"{file_name}.{file_type}",
                'file_path': file_path,
                'file_size': file_size,
                'status': 'success'
            }), 201
            
        except Exception as e:
            # 파일 생성 실패
            service.update_status(
                export_id=export_id,
                status='failed',
                error_message=str(e)
            )
            
            return jsonify({
                'error': str(e),
                'message': '파일 생성에 실패했습니다.',
                'export_id': export_id
            }), 500
        
    except Exception as e:
        print(f"[ERROR] 내보내기 생성 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': '내보내기를 생성하는데 실패했습니다.'
        }), 500


@bp.route('/<int:export_id>/download', methods=['GET'])
def download_export(export_id: int):
    """내보내기 파일 다운로드"""
    try:
        service = ExportHistoryService()
        export_record = service.get_by_id(export_id)
        
        if not export_record:
            return jsonify({
                'error': '내보내기 이력을 찾을 수 없습니다.'
            }), 404
        
        if export_record['status'] != 'success':
            return jsonify({
                'error': f"파일이 {export_record['status']} 상태입니다."
            }), 400
        
        file_path = export_record.get('file_path')
        if not file_path or not os.path.exists(file_path):
            return jsonify({
                'error': '파일을 찾을 수 없습니다.'
            }), 404
        
        # 파일 다운로드
        return send_file(
            file_path,
            as_attachment=True,
            download_name=export_record['file_name']
        )
        
    except Exception as e:
        print(f"[ERROR] 파일 다운로드 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': '파일 다운로드에 실패했습니다.'
        }), 500


@bp.route('/<int:export_id>', methods=['GET'])
def get_export_detail(export_id: int):
    """내보내기 상세 정보 조회"""
    try:
        service = ExportHistoryService()
        export_record = service.get_by_id(export_id)
        
        if not export_record:
            return jsonify({
                'error': '내보내기 이력을 찾을 수 없습니다.'
            }), 404
        
        return jsonify(export_record), 200
        
    except Exception as e:
        print(f"[ERROR] 내보내기 상세 조회 실패: {e}")
        return jsonify({
            'error': str(e),
            'message': '내보내기 정보를 불러오는데 실패했습니다.'
        }), 500

