"""LLM 연동 라우트"""
from flask import Blueprint, request, jsonify
from app.services.llm_service import LlmService
from app.services.vector_search_service import VectorSearchService


bp = Blueprint('llm', __name__, url_prefix='/api/llm')


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
        data = request.get_json(force=True) or {}
        prompt = data.get('prompt', '').strip()
        # 기본 모델은 LlmService의 기본값 사용 (claude-3-5-haiku-latest)
        model = data.get('model', None)  # None이면 LlmService에서 기본값 사용
        conversation_history = data.get('conversation_history', [])  # 대화 히스토리
        panel_search_result = data.get('panel_search_result', None)  # 패널 검색 결과
        if not prompt:
            return jsonify({'error': 'prompt가 필요합니다.'}), 400

        svc = LlmService()
        res = svc.ask_for_sql_rows(
            prompt, 
            model=model, 
            conversation_history=conversation_history,
            panel_search_result=panel_search_result
        )
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


@bp.route('/semantic_search', methods=['POST'])
def semantic_search():
    """
    core.doc_embedding 테이블을 사용한 의미 기반 검색
    
    요청 형식:
    {
        "question": "사용자 질문"
    }
    
    응답 형식:
    {
        "sql": "생성된 SQL 쿼리",
        "results": [...],
        "summary": "결과 요약"
    }
    """
    try:
        data = request.get_json(force=True) or {}
        question = data.get('question', '').strip()
        model = data.get('model', None)
        
        if not question:
            return jsonify({'error': 'question이 필요합니다.'}), 400
        
        # 1. LLM으로 SQL 쿼리 생성
        llm_service = LlmService()
        sql_result = llm_service.generate_semantic_search_sql(question, model=model)
        
        if 'error' in sql_result:
            return jsonify(sql_result), 500
        
        query_type = sql_result.get('type', 'semantic')
        
        # 구조화된 쿼리인 경우 (의미 검색 없음)
        if query_type == 'structured':
            sql_query = sql_result.get('sql', '')
            if not sql_query:
                return jsonify({
                    'error': 'SQL 쿼리가 없습니다.',
                    'sql_result': sql_result
                }), 500
            
            # 직접 SQL 실행
            from app.services.sql_service import execute_sql_safe
            try:
                search_results = execute_sql_safe(
                    query=sql_query,
                    params={},
                    limit=10000  # 구조화된 쿼리는 최대 10000개
                )
            except Exception as e:
                import traceback
                print(f"[ERROR] 구조화된 쿼리 실행 실패: {e}")
                print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
                return jsonify({
                    'error': f'SQL 실행 실패: {str(e)}',
                    'type': 'sql_error'
                }), 500
            
            # 구조화된 쿼리는 요약 없이 결과만 반환
            return jsonify({
                'type': 'structured',
                'filters': sql_result.get('filters', {}),
                'sql': sql_query,
                'results': search_results,
                'result_count': len(search_results)
            }), 200
        
        # hybrid 쿼리인 경우 (구조적 필터 + 의미 검색)
        if query_type == 'hybrid':
            search_text = sql_result.get('search_text', question)
            sql_query = sql_result.get('sql', '')
            filters = sql_result.get('filters', {})
            
            if not sql_query or '<VECTOR>' not in sql_query:
                return jsonify({
                    'error': 'SQL 쿼리에 <VECTOR> 플레이스홀더가 없습니다.',
                    'sql_result': sql_result
                }), 500
            
            # 임베딩 생성 및 SQL 실행
            vector_service = VectorSearchService()
            
            print(f"[DEBUG] Hybrid 쿼리 - 생성된 SQL: {sql_query[:200]}...")
            print(f"[DEBUG] 검색 텍스트: {search_text}")
            print(f"[DEBUG] 필터: {filters}")
            
            try:
                search_results = vector_service.execute_semantic_search_sql(
                    sql_query=sql_query,
                    embedding_input=search_text
                )
                print(f"[DEBUG] 검색 결과 개수: {len(search_results) if search_results else 0}")
            except Exception as e:
                import traceback
                print(f"[ERROR] Hybrid 검색 실행 실패: {e}")
                print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
                raise
            
            # 결과 요약
            if search_results:
                summary_prompt = f"""다음은 데이터베이스 하이브리드 검색 결과입니다:

질문: {question}
필터: {filters}

검색 결과:
{str(search_results)[:2000]}

위 검색 결과를 바탕으로 사용자의 질문에 대한 답변을 자연스러운 한국어로 요약해주세요."""
                
                summary_response = llm_service.client.messages.create(
                    model=model or llm_service.get_default_model(),
                    max_tokens=512,
                    temperature=0,
                    messages=[
                        {"role": "user", "content": summary_prompt}
                    ],
                )
                summary = "\n".join(getattr(c, "text", "") for c in summary_response.content if getattr(c, "type", None) == "text")
            else:
                summary = "검색 결과가 없습니다."
            
            return jsonify({
                'type': 'hybrid',
                'search_text': search_text,
                'filters': filters,
                'sql': sql_query,
                'results': search_results,
                'summary': summary,
                'result_count': len(search_results)
            }), 200
        
        # 의미 검색 쿼리인 경우 (semantic)
        search_text = sql_result.get('search_text', question)
        sql_query = sql_result.get('sql', '')
        
        if not sql_query or '<VECTOR>' not in sql_query:
            return jsonify({
                'error': 'SQL 쿼리에 <VECTOR> 플레이스홀더가 없습니다.',
                'sql_result': sql_result
            }), 500
        
        # 2. 임베딩 생성 및 SQL 실행 (로컬 모델 사용)
        vector_service = VectorSearchService()
        
        # 디버깅: 생성된 SQL 로그
        print(f"[DEBUG] 생성된 SQL: {sql_query[:200]}...")
        print(f"[DEBUG] 검색 텍스트: {search_text}")
        
        try:
            search_results = vector_service.execute_semantic_search_sql(
                sql_query=sql_query,
                embedding_input=search_text
            )
            print(f"[DEBUG] 검색 결과 개수: {len(search_results) if search_results else 0}")
        except Exception as e:
            import traceback
            print(f"[ERROR] 검색 실행 실패: {e}")
            print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
            raise
        
        # 3. 결과 요약 (LLM 사용)
        if search_results:
            summary_prompt = f"""다음은 데이터베이스 의미 검색 결과입니다:

질문: {question}

검색 결과:
{str(search_results)[:2000]}  # 결과가 너무 길면 잘라냄

위 검색 결과를 바탕으로 사용자의 질문에 대한 답변을 자연스러운 한국어로 요약해주세요."""
            
            summary_response = llm_service.client.messages.create(
                model=model or llm_service.get_default_model(),
                max_tokens=512,
                temperature=0,
                messages=[
                    {"role": "user", "content": summary_prompt}
                ],
            )
            summary = "\n".join(getattr(c, "text", "") for c in summary_response.content if getattr(c, "type", None) == "text")
        else:
            summary = "검색 결과가 없습니다."
        
        return jsonify({
            'type': 'semantic',
            'search_text': search_text,
            'sql': sql_query,
            'results': search_results,
            'summary': summary,
            'result_count': len(search_results)
        }), 200
        
    except RuntimeError as e:
        return jsonify({'error': str(e), 'type': 'configuration_error'}), 500
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"의미 검색 오류: {error_trace}")
        return jsonify({'error': str(e), 'type': type(e).__name__}), 500


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
        from app.services.sql_service import execute_sql_safe
        from app.services.vector_search_service import VectorSearchService
        
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
                    WHERE table_schema = 'core' AND table_name = 'doc_embedding'
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
                query="SELECT COUNT(*) as cnt FROM core.doc_embedding",
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
                    FROM core.doc_embedding
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
                    SELECT id, content
                    FROM core.doc_embedding
                    LIMIT 5
                """,
                limit=5
            )
            result["samples"] = [
                {
                    "id": s.get('id'),
                    "content_preview": (s.get('content', '')[:100] + '...') if s.get('content') and len(s.get('content', '')) > 100 else s.get('content', '')
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


