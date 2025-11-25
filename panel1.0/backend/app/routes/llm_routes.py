"""LLM 연동 라우트"""
from flask import Blueprint, request, jsonify
from app.services.llm.client import LlmService
from app.services.data.vector import VectorSearchService
from app.services.data.executor import execute_sql_safe
import time


bp = Blueprint('llm', __name__, url_prefix='/api/llm')


def handle_analytical_query(question: str, classification_result: dict, llm_service: LlmService, model: str = None):
    """
    분석 질문 처리 (연령대별/성별별/지역별 분포 분석)
    
    예: "할인이나 포인트 멤버쉽 적립을 많이 애용하는 연령대는?"
    """
    try:
        search_text = classification_result.get('search_text')
        group_by = classification_result.get('group_by')  # 'age_range', 'gender', 'region'
        analysis_type = classification_result.get('analysis_type', 'distribution')
        
        if not search_text:
            return jsonify({
                'error': '분석 질문에는 search_text가 필요합니다.',
                'classification_result': classification_result
            }), 400
        
        vector_service = VectorSearchService()
        
        print(f"[DEBUG] Analytical 쿼리 - 검색 텍스트: {search_text}")
        print(f"[DEBUG] 집계 기준: {group_by}")
        print(f"[DEBUG] 분석 유형: {analysis_type}")
        
        # 유사도 임계값 적용 (정확도 향상 패치)
        # 분석 질문은 기본적으로 더 엄격하게
        distance_threshold = 0.68
        
        # 1. 의미 기반 검색으로 관련 패널 찾기 (core_v2 스키마)
        # execute_hybrid_search_sql 사용 (필터 없이 의미 검색만)
        search_results = vector_service.execute_hybrid_search_sql(
            embedding_input=search_text,
            filters=None,  # 분석 질문은 필터 없음
            limit=1000,  # 분석을 위해 충분한 데이터 필요
            distance_threshold=distance_threshold
        )
        
        if not search_results or len(search_results) == 0:
            return jsonify({
                'type': 'analytical',
                'search_text': search_text,
                'group_by': group_by,
                'analysis_type': analysis_type,
                'results': [],
                'distribution': [],
                'summary': '검색 결과가 없어 분석할 수 없습니다.'
            }), 200
        
        print(f"[DEBUG] 검색된 패널 수: {len(search_results)}")
        
        # 2. 검색된 패널의 respondent_id 추출 (core_v2에서는 직접 반환됨)
        respondent_ids = [str(r.get('respondent_id', '')) for r in search_results if r.get('respondent_id')]
        
        if not respondent_ids:
            return jsonify({
                'type': 'analytical',
                'search_text': search_text,
                'group_by': group_by,
                'analysis_type': analysis_type,
                'results': [],
                'distribution': [],
                'summary': 'respondent_id를 찾을 수 없어 분석할 수 없습니다.'
            }), 200
        
        # 3. respondent_id로 실제 패널 정보 조회 및 집계 (core_v2 스키마)
        # SQL 인젝션 방지를 위해 파라미터 바인딩 사용
        respondent_ids_placeholders = ', '.join([f'%(respondent_id_{i})s' for i in range(len(respondent_ids))])
        params = {f'respondent_id_{i}': rid for i, rid in enumerate(respondent_ids)}
        
        # GROUP BY 기준에 따라 집계 쿼리 생성 (core_v2.respondent 사용)
        if group_by == 'age_range':
            # 연령대별 집계 (birth_year 사용)
            aggregation_sql = f"""
                SELECT 
                    CASE 
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 10 AND 19 THEN '10대'
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 20 AND 29 THEN '20대'
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 30 AND 39 THEN '30대'
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 40 AND 49 THEN '40대'
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 50 AND 59 THEN '50대'
                        WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) >= 60 THEN '60대+'
                        ELSE '기타'
                    END AS age_group,
                    COUNT(*) AS count
                FROM core_v2.respondent
                WHERE respondent_id IN ({respondent_ids_placeholders})
                  AND birth_year IS NOT NULL
                GROUP BY age_group
                ORDER BY count DESC
            """
        elif group_by == 'gender':
            # 성별별 집계
            aggregation_sql = f"""
                SELECT 
                    gender AS gender_group,
                    COUNT(*) AS count
                FROM core_v2.respondent
                WHERE respondent_id IN ({respondent_ids_placeholders})
                  AND gender IS NOT NULL
                GROUP BY gender
                ORDER BY count DESC
            """
        elif group_by == 'region':
            # 지역별 집계 (상위 10개)
            aggregation_sql = f"""
                SELECT 
                    region AS region_group,
                    COUNT(*) AS count
                FROM core_v2.respondent
                WHERE respondent_id IN ({respondent_ids_placeholders})
                  AND region IS NOT NULL
                GROUP BY region
                ORDER BY count DESC
                LIMIT 10
            """
        else:
            return jsonify({
                'error': f'지원하지 않는 집계 기준입니다: {group_by}',
                'classification_result': classification_result
            }), 400
        
        # 집계 쿼리 실행
        distribution_results = execute_sql_safe(
            query=aggregation_sql,
            params=params,
            limit=20
        )
        
        print(f"[DEBUG] 집계 결과: {distribution_results}")
        
        # 4. 결과 요약 생성
        if distribution_results:
            # 가장 많은 그룹 찾기
            if analysis_type == 'most_frequent':
                top_group = distribution_results[0]
                group_name = top_group.get(list(top_group.keys())[0])
                count = top_group.get('count', 0)
                total = sum(r.get('count', 0) for r in distribution_results)
                percentage = (count / total * 100) if total > 0 else 0
                
                summary = f"{search_text}와 관련된 패널 중 {group_name}이(가) {count}명({percentage:.1f}%)로 가장 많습니다."
            else:
                # 분포 요약
                total = sum(r.get('count', 0) for r in distribution_results)
                dist_summary = ", ".join([
                    f"{r.get(list(r.keys())[0])}: {r.get('count', 0)}명({r.get('count', 0)/total*100:.1f}%)"
                    for r in distribution_results[:5]
                ])
                summary = f"{search_text}와 관련된 패널 분포: {dist_summary} (총 {total}명)"
        else:
            summary = "집계 결과가 없습니다."
        
        return jsonify({
            'type': 'analytical',
            'search_text': search_text,
            'group_by': group_by,
            'analysis_type': analysis_type,
            'results': search_results[:10],  # 샘플 결과
            'distribution': distribution_results,
            'summary': summary,
            'total_matched': len(search_results)
        }), 200
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] Analytical 쿼리 처리 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{error_trace}")
        return jsonify({
            'error': f'분석 쿼리 처리 실패: {str(e)}',
            'type': 'analytical_error'
        }), 500


@bp.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.get_json(force=True) or {}
        prompt = data.get('prompt', '').strip()
        # 기본 모델은 LlmService의 기본값 사용 (claude-3-5-haiku-latest)
        model = data.get('model', None)  # None이면 LlmService에서 기본값 사용
        if not prompt:
            return jsonify({'error': 'prompt가 필요합니다.'}), 400

        svc = LlmService()
        res = svc.ask_with_tools(prompt, model=model)
        return jsonify(res), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/sql_search', methods=['POST'])
def sql_search():
    try:
        t0 = time.perf_counter()
        data = request.get_json(force=True) or {}
        t1 = time.perf_counter()
        
        prompt = data.get('prompt', '').strip()
        # 기본 모델은 LlmService의 기본값 사용 (claude-3-5-haiku-latest)
        model = data.get('model', None)  # None이면 LlmService에서 기본값 사용
        conversation_history = data.get('conversation_history', [])  # 대화 히스토리
        panel_search_result = data.get('panel_search_result', None)  # 패널 검색 결과
        if not prompt:
            return jsonify({'error': 'prompt가 필요합니다.'}), 400

        print(f"[PERF][SQL] sql_search START prompt='{prompt[:50]}'")
        print(f"[PERF][SQL] 1. read_request / parse_json: {t1 - t0:.3f}s")
        
        t2_start = time.perf_counter()
        svc = LlmService()
        t2_end = time.perf_counter()
        print(f"[PERF][SQL] 2. LlmService init: {t2_end - t2_start:.3f}s")
        
        t3_start = time.perf_counter()
        res = svc.ask_for_sql_rows(
            prompt, 
            model=model, 
            conversation_history=conversation_history,
            panel_search_result=panel_search_result
        )
        t3_end = time.perf_counter()
        print(f"[PERF][SQL] 3. ask_for_sql_rows (LLM+SQL+DB): {t3_end - t3_start:.3f}s")

        t_end = time.perf_counter()
        print(f"[PERF][SQL] total: {t_end - t0:.3f}s")
        print(f"[PERF][SQL] sql_search END")
        
        return jsonify(res), 200
    except RuntimeError as e:
        # API 키 누락 등 초기화 오류
        return jsonify({'error': str(e), 'type': 'configuration_error'}), 500
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"LLM SQL 검색 오류: {error_trace}")
        return jsonify({'error': str(e), 'type': type(e).__name__}), 500


@bp.route('/models', methods=['GET'])
def list_models():
    try:
        svc = LlmService()
        return jsonify(svc.list_models()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/current_model', methods=['GET'])
def get_current_model():
    """현재 사용 중인 기본 Claude 모델 확인"""
    try:
        svc = LlmService()
        current_model = svc.get_default_model()
        # 환경변수에서 실제 설정값 확인
        import os
        env_model = os.environ.get("ANTHROPIC_MODEL")
        
        return jsonify({
            'current_model': current_model,
            'source': 'environment_variable' if env_model else 'default',
            'environment_variable': env_model if env_model else None,
            'default_value': 'claude-sonnet-4-5' if not env_model else None
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# semantic_search 엔드포인트 제거됨 - 통합 검색 /api/search로 대체됨


@bp.route('/test_embeddings', methods=['GET'])
def test_embeddings():
    """
    DB 임베딩 데이터 테스트 엔드포인트
    
    응답 형식:
    {
        "table_exists": true,
        "record_count": 1000,
        "embedding_dimension": 1024,
        "samples": [...],
        "embedding_service_status": "ok" or "error"
    }
    """
    try:
        from app.services.data.executor import execute_sql_safe
        from app.services.data.vector import VectorSearchService
        
        result = {
            "table_exists": False,
            "record_count": 0,
            "embedding_dimension": None,
            "samples": [],
            "embedding_service_status": "unknown"
        }
        
        # 1. 테이블 존재 확인
        try:
            tables = execute_sql_safe(
                query="""
                    SELECT table_schema, table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'core_v2' AND table_name = 'panel_embedding'
                """,
                limit=1
            )
            result["table_exists"] = len(tables) > 0
        except Exception as e:
            return jsonify({'error': f'테이블 확인 실패: {str(e)}'}), 500
        
        if not result["table_exists"]:
            return jsonify(result), 200
        
        # 2. 데이터 개수 확인
        try:
            count_result = execute_sql_safe(
                query="SELECT COUNT(*) as cnt FROM core_v2.panel_embedding",
                limit=1
            )
            if count_result:
                result["record_count"] = int(count_result[0].get('cnt', 0))
        except Exception as e:
            return jsonify({'error': f'데이터 개수 확인 실패: {str(e)}'}), 500
        
        # 3. 임베딩 차원 확인
        try:
            sample = execute_sql_safe(
                query="""
                    SELECT embedding::text as embedding_str
                    FROM core_v2.panel_embedding
                    WHERE embedding IS NOT NULL
                    LIMIT 1
                """,
                limit=1
            )
            if sample and sample[0].get('embedding_str'):
                embedding_str = sample[0]['embedding_str']
                embedding_str = embedding_str.strip('[]')
                if embedding_str:
                    result["embedding_dimension"] = len(embedding_str.split(','))
        except Exception as e:
            return jsonify({'error': f'차원 확인 실패: {str(e)}'}), 500
        
        # 4. 샘플 데이터
        try:
            samples = execute_sql_safe(
                query="""
                    SELECT respondent_id, embedding::text as embedding_preview
                    FROM core_v2.panel_embedding
                    LIMIT 5
                """,
                limit=5
            )
            result["samples"] = [
                {
                    "respondent_id": s.get('respondent_id'),
                    "embedding_preview": (s.get('embedding_preview', '')[:100] + '...') if s.get('embedding_preview') and len(s.get('embedding_preview', '')) > 100 else s.get('embedding_preview', '')
                }
                for s in samples
            ]
        except Exception as e:
            return jsonify({'error': f'샘플 데이터 확인 실패: {str(e)}'}), 500
        
        # 5. 임베딩 서비스 상태 확인
        try:
            vector_service = VectorSearchService()
            test_embedding = vector_service.get_query_embedding("테스트")
            if test_embedding:
                result["embedding_service_status"] = "ok"
                result["embedding_service_dimension"] = len(test_embedding)
                if result["embedding_dimension"] and len(test_embedding) != result["embedding_dimension"]:
                    result["embedding_service_status"] = f"dimension_mismatch (DB: {result['embedding_dimension']}, Service: {len(test_embedding)})"
            else:
                result["embedding_service_status"] = "no_embedding_service"
        except Exception as e:
            result["embedding_service_status"] = f"error: {str(e)}"
        
        return jsonify(result), 200
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"임베딩 테스트 오류: {error_trace}")
        return jsonify({'error': str(e), 'type': type(e).__name__}), 500


