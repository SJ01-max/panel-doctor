"""LLM 연동 라우트"""
from flask import Blueprint, request, jsonify
from app.services.llm_service import LlmService


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
        if not prompt:
            return jsonify({'error': 'prompt가 필요합니다.'}), 400

        svc = LlmService()
        res = svc.ask_for_sql_rows(prompt, model=model)
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


