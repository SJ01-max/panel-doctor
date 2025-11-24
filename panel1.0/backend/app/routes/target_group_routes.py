"""타겟 그룹 API 라우트"""
from flask import Blueprint, request, jsonify
from app.services.data.target_group import TargetGroupService
from app.services.data.sql_builder import SQLBuilder
from app.services.data.executor import execute_sql_safe
from app.services.llm.client import LlmService
from app.utils.panel_schema import ensure_interests_column_exists
import traceback
import json
import re


bp = Blueprint('target_groups', __name__, url_prefix='/api/target-groups')


@bp.route('', methods=['GET'])
def get_target_groups():
    """타겟 그룹 목록 조회"""
    try:
        service = TargetGroupService()
        groups = service.get_all()
        
        return jsonify({
            'groups': groups,
            'total': len(groups)
        }), 200
    except Exception as e:
        print(f"[ERROR] 타겟 그룹 목록 조회 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': '타겟 그룹 목록을 불러오는데 실패했습니다.'
        }), 500


@bp.route('/<int:group_id>', methods=['GET'])
def get_target_group(group_id):
    """타겟 그룹 상세 조회"""
    try:
        service = TargetGroupService()
        group = service.get_by_id(group_id)
        
        if not group:
            return jsonify({
                'error': '타겟 그룹을 찾을 수 없습니다.',
                'message': f'ID {group_id}에 해당하는 타겟 그룹이 없습니다.'
            }), 404
        
        return jsonify({
            'group': group
        }), 200
    except Exception as e:
        print(f"[ERROR] 타겟 그룹 상세 조회 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': '타겟 그룹을 불러오는데 실패했습니다.'
        }), 500


@bp.route('', methods=['POST'])
def create_target_group():
    """타겟 그룹 생성 (태그 필터 포함하여 패널 수 자동 계산)"""
    try:
        from app.utils.calculate_panel_count import calculate_panel_count, generate_summary
        
        data = request.get_json(force=True) or {}
        
        # 필수 필드 검증
        if not data.get('name'):
            return jsonify({
                'error': 'name 필드가 필요합니다.',
                'message': '타겟 그룹 이름을 입력해주세요.'
            }), 400
        
        # 필터 정보 추출
        filters = data.get('filters', {})
        tags = data.get('tags', [])
        
        # 연령대, 성별, 지역 추출
        age_range = None
        gender = None
        region = None
        
        # ageRange 필드에서 추출 (프론트엔드 형식: "20–29세")
        age_range_input = filters.get('ageRange') or data.get('ageRange')
        if age_range_input and age_range_input != '전체':
            if re.search(r'10[–-]19', age_range_input) or (age_range_input.startswith('10') and '19' in age_range_input):
                age_range = '10s'
            elif re.search(r'20[–-]29', age_range_input) or (age_range_input.startswith('20') and '29' in age_range_input):
                age_range = '20s'
            elif re.search(r'30[–-]39', age_range_input) or (age_range_input.startswith('30') and '39' in age_range_input):
                age_range = '30s'
            elif re.search(r'40[–-]49', age_range_input) or (age_range_input.startswith('40') and '49' in age_range_input):
                age_range = '40s'
            elif re.search(r'50[–-]59', age_range_input) or (age_range_input.startswith('50') and '59' in age_range_input):
                age_range = '50s'
            elif '60' in age_range_input or '이상' in age_range_input:
                age_range = '60s'
        
        # gender 필드에서 추출
        gender_input = filters.get('gender') or data.get('gender')
        if gender_input and gender_input != '전체':
            if gender_input in ['남성', '남자', '남']:
                gender = 'M'
            elif gender_input in ['여성', '여자', '여']:
                gender = 'F'
        
        # region 필드에서 추출
        region_input = filters.get('region') or data.get('region')
        if region_input and region_input != '전국':
            region = region_input
        
        # 패널 수 계산 (태그 제외 - 연령/성별/지역만)
        # 태그는 interests 데이터가 없어서 필터링이 작동하지 않으므로 제외
        calculated_size = calculate_panel_count(
            age_range=age_range,
            gender=gender,
            region=region,
            tags=None  # 태그 제외
        )
        
        # summary 생성 (태그 포함)
        summary = generate_summary(
            age_range=age_range,
            gender=gender,
            region=region,
            tags=tags if tags else None
        )
        
        # 데이터 준비
        create_data = {
            'name': data.get('name'),
            'summary': summary,
            'size': calculated_size,  # 계산된 패널 수
            'tags': tags if tags else [],
            'filters': {
                'ageRange': age_range_input,
                'gender': gender_input,
                'region': region_input
            },
            'description': data.get('description'),
            'created_by': data.get('created_by')
        }
        
        service = TargetGroupService()
        new_group = service.create(create_data)
        
        return jsonify(new_group), 201
    except Exception as e:
        print(f"[ERROR] 타겟 그룹 생성 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': '타겟 그룹 생성에 실패했습니다.'
        }), 500


@bp.route('/<int:group_id>', methods=['PUT'])
def update_target_group(group_id):
    """타겟 그룹 수정 (조건 변경 시 패널 수 자동 재계산)"""
    try:
        from app.utils.calculate_panel_count import calculate_panel_count, generate_summary
        
        data = request.get_json(force=True) or {}
        
        service = TargetGroupService()
        
        # 기존 그룹 정보 조회
        existing_group = service.get_by_id(group_id)
        if not existing_group:
            return jsonify({
                'error': '타겟 그룹을 찾을 수 없습니다.',
                'message': f'ID {group_id}에 해당하는 타겟 그룹이 없습니다.'
            }), 404
        
        # 기존 필터 정보 가져오기
        existing_filters = existing_group.get('filters', {})
        existing_tags = existing_group.get('tags', [])
        
        # 업데이트할 필터 정보 (새 값이 있으면 사용, 없으면 기존 값 사용)
        filters = data.get('filters', existing_filters)
        tags = data.get('tags', existing_tags)
        
        # 연령대, 성별, 지역 추출
        age_range = None
        gender = None
        region = None
        
        # ageRange 필드에서 추출
        age_range_input = filters.get('ageRange') or data.get('ageRange')
        if age_range_input and age_range_input != '전체':
            if re.search(r'10[–-]19', age_range_input) or (age_range_input.startswith('10') and '19' in age_range_input):
                age_range = '10s'
            elif re.search(r'20[–-]29', age_range_input) or (age_range_input.startswith('20') and '29' in age_range_input):
                age_range = '20s'
            elif re.search(r'30[–-]39', age_range_input) or (age_range_input.startswith('30') and '39' in age_range_input):
                age_range = '30s'
            elif re.search(r'40[–-]49', age_range_input) or (age_range_input.startswith('40') and '49' in age_range_input):
                age_range = '40s'
            elif re.search(r'50[–-]59', age_range_input) or (age_range_input.startswith('50') and '59' in age_range_input):
                age_range = '50s'
            elif '60' in age_range_input or '이상' in age_range_input:
                age_range = '60s'
        
        # gender 필드에서 추출
        gender_input = filters.get('gender') or data.get('gender')
        if gender_input and gender_input != '전체':
            if gender_input in ['남성', '남자', '남']:
                gender = 'M'
            elif gender_input in ['여성', '여자', '여']:
                gender = 'F'
        
        # region 필드에서 추출
        region_input = filters.get('region') or data.get('region')
        if region_input and region_input != '전국':
            region = region_input
        
        # 필터나 태그가 변경되었으면 패널 수 재계산
        should_recalculate = (
            'filters' in data or 'tags' in data or
            'ageRange' in data or 'gender' in data or 'region' in data
        )
        
        if should_recalculate:
            # 패널 수 계산 (태그 제외 - 연령/성별/지역만)
            # 태그는 interests 데이터가 없어서 필터링이 작동하지 않으므로 제외
            calculated_size = calculate_panel_count(
                age_range=age_range,
                gender=gender,
                region=region,
                tags=None  # 태그 제외
            )
            
            # summary 생성 (태그 포함)
            summary = generate_summary(
                age_range=age_range,
                gender=gender,
                region=region,
                tags=tags if tags else None
            )
            
            # 업데이트 데이터에 size와 summary 포함
            data['size'] = calculated_size
            data['summary'] = summary
        
        updated_group = service.update(group_id, data)
        
        if not updated_group:
            return jsonify({
                'error': '타겟 그룹을 찾을 수 없습니다.',
                'message': f'ID {group_id}에 해당하는 타겟 그룹이 없습니다.'
            }), 404
        
        return jsonify(updated_group), 200
    except Exception as e:
        print(f"[ERROR] 타겟 그룹 수정 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': '타겟 그룹 수정에 실패했습니다.'
        }), 500


@bp.route('/<int:group_id>', methods=['DELETE'])
def delete_target_group(group_id):
    """타겟 그룹 삭제"""
    try:
        service = TargetGroupService()
        deleted = service.delete(group_id)
        
        if not deleted:
            return jsonify({
                'error': '타겟 그룹을 찾을 수 없습니다.',
                'message': f'ID {group_id}에 해당하는 타겟 그룹이 없습니다.'
            }), 404
        
        return jsonify({
            'message': '타겟 그룹이 삭제되었습니다.'
        }), 200
    except Exception as e:
        print(f"[ERROR] 타겟 그룹 삭제 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': '타겟 그룹 삭제에 실패했습니다.'
        }), 500


@bp.route('/stats', methods=['GET'])
def get_target_group_stats():
    """타겟 그룹 통계 조회"""
    try:
        service = TargetGroupService()
        stats = service.get_stats()
        
        return jsonify(stats), 200
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] 타겟 그룹 통계 조회 실패: {error_msg}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        
        # DB 연결 오류인 경우 더 명확한 메시지 제공
        if 'could not translate host name' in error_msg or 'Name or service not known' in error_msg:
            return jsonify({
                'error': 'database_connection_error',
                'message': '데이터베이스 서버에 연결할 수 없습니다. 네트워크 연결과 DB 설정을 확인해주세요.',
                'details': 'DNS 해석 실패: 데이터베이스 호스트 이름을 찾을 수 없습니다.'
            }), 503  # Service Unavailable
        elif 'OperationalError' in str(type(e).__name__):
            return jsonify({
                'error': 'database_connection_error',
                'message': '데이터베이스 연결에 실패했습니다.',
                'details': error_msg
            }), 503
        
        return jsonify({
            'error': str(e),
            'message': '타겟 그룹 통계를 불러오는데 실패했습니다.'
        }), 500


@bp.route('/available-tags', methods=['GET'])
def get_available_tags():
    """
    실제 DB에 있는 interests 태그 목록 조회
    
    응답:
    {
        "tags": ["OTT", "금융", "헬스", ...],
        "count": 15,
        "has_data": true/false  // interests 데이터 존재 여부
    }
    """
    try:
        ensure_interests_column_exists()
        
        # interests 배열에서 모든 고유한 태그 추출
        # unnest를 사용하여 배열을 행으로 변환하고 DISTINCT로 중복 제거
        query = """
            SELECT DISTINCT unnest(interests) as tag
            FROM "core_v2"."respondent"
            WHERE interests IS NOT NULL
            AND array_length(interests, 1) > 0
            ORDER BY tag;
        """
        
        result = execute_sql_safe(
            query=query,
            params=None,
            limit=100  # 최대 100개 태그
        )
        
        tags = [row['tag'] for row in result if row.get('tag')]
        
        # 빈 문자열 제거 및 정렬
        tags = sorted([tag.strip() for tag in tags if tag and tag.strip()])
        
        # interests 데이터 존재 여부 확인
        has_data = len(tags) > 0
        
        print(f"[INFO] 사용 가능한 태그 {len(tags)}개 조회 (데이터 존재: {has_data})")
        
        # 데이터가 없으면 기본 태그 목록 반환 (fallback)
        if not has_data:
            print(f"[WARN] interests 컬럼에 데이터가 없어 기본 태그 목록을 반환합니다.")
            tags = ["헬스", "여행", "OTT", "게임", "커피", "이커머스", "금융", "구독", "SNS", "배달", "편의점"]
        
        return jsonify({
            'tags': tags,
            'count': len(tags),
            'has_data': has_data,
            'message': 'interests 데이터가 없습니다. 기본 태그 목록을 사용합니다.' if not has_data else None
        }), 200
        
    except Exception as e:
        print(f"[ERROR] 태그 목록 조회 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        # 에러 발생 시 기본 태그 목록 반환 (프론트엔드가 계속 작동하도록)
        return jsonify({
            'tags': ["헬스", "여행", "OTT", "게임", "커피", "이커머스", "금융", "구독", "SNS", "배달", "편의점"],
            'count': 11,
            'has_data': False,
            'error': str(e),
            'message': '태그 목록을 불러오는데 실패했습니다. 기본 태그 목록을 사용합니다.'
        }), 200


@bp.route('/estimate-count', methods=['POST'])
def estimate_panel_count():
    """
    타겟 그룹 조건에 따른 예상 패널 수 계산 (태그 필터 포함)
    
    요청:
    {
        "filters": {
            "ageRange": "20–29세",
            "gender": "남성",
            "region": "인천"
        },
        "tags": ["OTT", "금융"]  // 선택사항
    }
    
    응답:
    {
        "count": 1234,
        "filters_applied": {...}
    }
    """
    try:
        from app.utils.calculate_panel_count import calculate_panel_count
        
        data = request.get_json(force=True) or {}
        filters_data = data.get('filters', {})
        tags = data.get('tags', [])  # 태그 배열 추가
        
        # 프론트엔드 필터 형식을 백엔드 형식으로 변환
        age_range = None
        gender = None
        region = None
        
        # 연령대 변환: "20–29세" → "20s"
        age_range_input = filters_data.get('ageRange', '')
        if age_range_input and age_range_input != '전체':
            # 정확한 매칭을 위해 정규식 사용
            if re.search(r'10[–-]19', age_range_input) or (age_range_input.startswith('10') and '19' in age_range_input):
                age_range = '10s'
            elif re.search(r'20[–-]29', age_range_input) or (age_range_input.startswith('20') and '29' in age_range_input):
                age_range = '20s'
            elif re.search(r'30[–-]39', age_range_input) or (age_range_input.startswith('30') and '39' in age_range_input):
                age_range = '30s'
            elif re.search(r'40[–-]49', age_range_input) or (age_range_input.startswith('40') and '49' in age_range_input):
                age_range = '40s'
            elif re.search(r'50[–-]59', age_range_input) or (age_range_input.startswith('50') and '59' in age_range_input):
                age_range = '50s'
            elif '60' in age_range_input or '이상' in age_range_input:
                age_range = '60s'
        
        # 성별 변환: "남성" → "M", "여성" → "F"
        gender_input = filters_data.get('gender', '')
        if gender_input and gender_input != '전체':
            if gender_input in ['남성', '남자', '남']:
                gender = 'M'
            elif gender_input in ['여성', '여자', '여']:
                gender = 'F'
        
        # 지역 변환
        region_input = filters_data.get('region', '')
        if region_input and region_input != '전국':
            region = region_input
        
        # 디버깅 로그
        print(f"[DEBUG] estimate_panel_count 요청:")
        print(f"  age_range: {age_range}")
        print(f"  gender: {gender}")
        print(f"  region: {region}")
        print(f"  tags: {tags}")
        
        # 태그가 있는 경우 interests 데이터 현황 확인 (첫 요청 시에만)
        if tags and len(tags) > 0:
            try:
                from app.utils.check_interests_data import check_interests_data, check_tag_match
                # 첫 태그에 대해 매칭 확인
                check_tag_match(tags[0])
                
                # interests 데이터 현황도 확인 (디버깅용)
                try:
                    data_status = check_interests_data()
                    if data_status['not_null_count'] == 0:
                        print(f"[WARN] interests 컬럼에 데이터가 없습니다. 태그 필터링이 작동하지 않을 수 있습니다.")
                except:
                    pass  # 데이터 현황 확인 실패는 무시
            except Exception as e:
                print(f"[WARN] interests 데이터 확인 실패 (계속 진행): {e}")
        
        # 패널 수 계산 (태그 포함)
        total_count = calculate_panel_count(
            age_range=age_range,
            gender=gender,
            region=region,
            tags=tags if tags else None
        )
        
        # 응답용 필터 정보 구성
        filters_applied = {}
        if age_range:
            filters_applied['age_range'] = age_range
        if gender:
            filters_applied['gender'] = gender
        if region:
            filters_applied['region'] = region
        if tags:
            filters_applied['tags'] = tags
        
        print(f"[DEBUG] estimate_panel_count 결과: {total_count}명")
        
        return jsonify({
            'count': total_count,
            'filters_applied': filters_applied
        }), 200
        
    except Exception as e:
        print(f"[ERROR] 예상 패널 수 계산 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': '예상 패널 수를 계산하는데 실패했습니다.'
        }), 500


@bp.route('/ai-recommend', methods=['POST'])
def ai_recommend_target_group():
    """
    AI 기반 타겟 그룹 추천
    
    요청:
    {
        "context": "최근 캠페인 이력이나 목적 설명" (선택사항)
    }
    
    응답:
    {
        "recommendedGroups": [
            {
                "name": "추천 타겟 그룹명",
                "summary": "조건 요약",
                "filters": {...},
                "tags": [...],
                "reason": "추천 이유"
            }
        ]
    }
    """
    try:
        data = request.get_json(force=True) or {}
        context = data.get('context', '')
        
        # LLM 서비스를 사용하여 타겟 그룹 추천
        llm_service = LlmService()
        
        # 추천 프롬프트 구성
        prompt = f"""다음 컨텍스트를 바탕으로 유용한 타겟 그룹을 추천해주세요.

컨텍스트: {context if context else '최근 캠페인이나 다운로드 이력이 없습니다. 일반적인 타겟 그룹을 추천해주세요.'}

다음 형식의 JSON 배열로 응답해주세요:
[
  {{
    "name": "타겟 그룹명",
    "summary": "연령 XX세 · 성별 XX · 지역 XX",
    "filters": {{
      "ageRange": "20–29세",
      "gender": "남성",
      "region": "서울"
    }},
    "tags": ["태그1", "태그2"],
    "reason": "추천 이유 설명"
  }}
]

3-5개의 타겟 그룹을 추천해주세요. JSON만 응답하고 다른 텍스트는 포함하지 마세요."""

        response = llm_service.ask_with_tools(prompt)
        ai_response = response.get('response', '')
        
        # JSON 파싱 시도
        try:
            # JSON 부분만 추출 (마크다운 코드 블록 제거)
            if '```json' in ai_response:
                json_start = ai_response.find('```json') + 7
                json_end = ai_response.find('```', json_start)
                ai_response = ai_response[json_start:json_end].strip()
            elif '```' in ai_response:
                json_start = ai_response.find('```') + 3
                json_end = ai_response.find('```', json_start)
                ai_response = ai_response[json_start:json_end].strip()
            
            recommended_groups = json.loads(ai_response)
            
            return jsonify({
                'recommendedGroups': recommended_groups
            }), 200
        except json.JSONDecodeError as e:
            print(f"[WARN] AI 응답 JSON 파싱 실패: {e}")
            print(f"[WARN] AI 응답 내용: {ai_response}")
            
            # 기본 추천 그룹 반환
            return jsonify({
                'recommendedGroups': [
                    {
                        'name': '서울 20대 여성',
                        'summary': '연령 20–29세 · 성별 여성 · 지역 서울',
                        'filters': {
                            'ageRange': '20–29세',
                            'gender': '여성',
                            'region': '서울'
                        },
                        'tags': ['OTT', 'SNS', '헬스'],
                        'reason': '일반적으로 많이 사용되는 타겟 그룹입니다.'
                    }
                ]
            }), 200
        
    except Exception as e:
        print(f"[ERROR] AI 타겟 그룹 추천 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'message': 'AI 추천을 생성하는데 실패했습니다.'
        }), 500
