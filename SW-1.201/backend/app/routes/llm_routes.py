"""LLM 연동 라우트"""
from flask import Blueprint, request, jsonify
from app.services.llm_service import LlmService


bp = Blueprint('llm', __name__, url_prefix='/api/llm')


@bp.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.get_json(force=True) or {}
        prompt = data.get('prompt', '').strip()
        model = data.get('model', 'claude-3-5-sonnet-20241022')
        if not prompt:
            return jsonify({'error': 'prompt가 필요합니다.'}), 400

        svc = LlmService()
        res = svc.ask_with_tools(prompt, model=model)
        return jsonify(res), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


