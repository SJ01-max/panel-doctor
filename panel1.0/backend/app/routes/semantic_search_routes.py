"""
의미 기반 검색 전용 엔드포인트
- /api/semantic-search: 의미 기반 검색 결과를 사용자 친화적인 형식으로 반환
"""
from flask import Blueprint, request, jsonify
from app.services.search.service import SearchService
from app.services.semantic.features import extract_panel_features, PanelFeatures
from app.services.semantic.match_reason import generate_match_reasons
from app.services.semantic.common_insights import generate_common_features
from app.services.semantic.semantic_keywords import generate_semantic_keywords
from typing import Dict, Any, List

bp = Blueprint('semantic_search', __name__, url_prefix='/api/semantic-search')


def calculate_stats(panels: List[Dict[str, Any]]) -> Dict[str, Any]:
    """패널 리스트에서 통계 계산"""
    if not panels or len(panels) == 0:
        return {
            'avg': 0,
            'max': 0,
            'top10_avg': 0,
            'count': 0
        }
    
    # distance를 score로 변환 (distance는 0에 가까울수록 유사도 높음)
    scores = []
    for panel in panels:
        distance = panel.get('distance', 2.0)  # 기본값 2.0 (0% 매칭)
        # distance를 0-100 점수로 변환
        score = max(0, min(100, int((1 - distance / 2.0) * 100)))
        scores.append(score)
    
    if not scores:
        return {
            'avg': 0,
            'max': 0,
            'top10_avg': 0,
            'count': 0
        }
    
    scores.sort(reverse=True)  # 내림차순 정렬
    avg = int(sum(scores) / len(scores))
    max_score = scores[0] if scores else 0
    top10_count = max(1, int(len(scores) * 0.1))
    top10_avg = int(sum(scores[:top10_count]) / top10_count) if scores else 0
    
    return {
        'avg': avg,
        'max': max_score,
        'top10_avg': top10_avg,
        'count': len(panels)
    }


def transform_panels(panels: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """검색 결과를 UI 친화적인 형식으로 변환"""
    transformed = []
    for panel in panels:
        distance = panel.get('distance', 2.0)
        score = max(0, min(100, int((1 - distance / 2.0) * 100)))
        
        # age_text에서 나이 추출
        age_text = panel.get('age_text', '')
        age = None
        if age_text:
            import re
            age_match = re.search(r'(\d+)세', age_text)
            if age_match:
                age = int(age_match.group(1))
            else:
                # birth_year에서 계산
                birth_year = panel.get('birth_year')
                if birth_year:
                    from datetime import datetime
                    age = datetime.now().year - birth_year
        
        transformed.append({
            'respondent_id': panel.get('respondent_id', ''),
            'age': age or 0,
            'age_text': age_text,
            'gender': panel.get('gender', ''),
            'region': panel.get('region', ''),
            'score': score,
            'distance': distance,
            'tags': [],  # 추후 태그 추출 로직 추가 가능
            'content': panel.get('json_doc', '') or panel.get('content', ''),
            # panel_features / match_reasons는 아래 semantic_search 함수에서 채움
        })
    
    return transformed


@bp.route('', methods=['POST'])
def semantic_search():
    """
    의미 기반 검색 전용 엔드포인트
    
    요청:
    {
        "query": "우울한 사람"
    }
    
    응답:
    {
        "query": "우울한 사람",
        "keywords": ["우울"],
        "summary": "대체로 20대 여성 비율이 높으며...",
        "stats": {
            "avg": 72,
            "max": 87,
            "top10_avg": 81,
            "count": 50
        },
        "panels": [
            {
                "respondent_id": "w10002",
                "age": 29,
                "gender": "F",
                "region": "서울 강서구",
                "score": 78,
                "tags": ["우울", "불면"]
            }
        ]
    }
    """
    try:
        data = request.get_json(force=True) or {}
        query = data.get('query', '').strip()
        
        if not query:
            return jsonify({
                'error': 'query가 필요합니다.',
                'message': '자연어 질의를 입력해주세요.'
            }), 400
        
        # 통합 검색 서비스 실행 (semantic_first 전략 사용)
        search_service = SearchService()
        result = search_service.search(user_query=query)
        
        # semantic_first 전략이 아니면 에러
        if result.get('strategy') != 'semantic_first':
            # semantic_first로 강제 전환 시도
            parsed_query = result.get('parsed_query', {})
            semantic_keywords = parsed_query.get('semantic_keywords', [])
            if not semantic_keywords:
                semantic_keywords = [query]  # 전체 질의를 키워드로 사용
            
            # semantic_first로 직접 검색
            semantic_result = search_service.semantic_search.search(
                semantic_keywords=semantic_keywords,
                limit=500
            )
            result = semantic_result
        
        # 결과 변환
        panels = result.get('results', [])
        transformed_panels = transform_panels(panels)
        stats = calculate_stats(panels)
        
        # panel_features / match_reasons 생성 (상위 N명 중심)
        top_n = min(50, len(transformed_panels))
        top_panels_slice = transformed_panels[:top_n]

        panel_features_list: List[PanelFeatures] = []
        for idx, p in enumerate(top_panels_slice):
            raw_panel = panels[idx] if idx < len(panels) else {}
            features = extract_panel_features(raw_panel)
            panel_features_list.append(features)

        # 공통 특징 생성
        common_features = generate_common_features(panel_features_list) if panel_features_list else []

        # ★ 임베딩 결과 기반 핵심 키워드 추출 (TF-IDF keyword_affinity 집계)
        embedding_based_keywords = []
        if panel_features_list:
            # 모든 패널의 keyword_affinity 집계
            all_keyword_scores: Dict[str, float] = {}
            for pf in panel_features_list:
                features_dict = pf.to_dict()
                keyword_affinity = features_dict.get("keyword_affinity", {})
                for kw, score in keyword_affinity.items():
                    if kw not in all_keyword_scores:
                        all_keyword_scores[kw] = 0.0
                    all_keyword_scores[kw] += score
            
            # 상위 키워드 추출 (점수 기준 정렬, 상위 10개)
            sorted_keywords = sorted(
                all_keyword_scores.items(),
                key=lambda x: x[1],
                reverse=True
            )[:10]
            embedding_based_keywords = [kw for kw, score in sorted_keywords if score > 0]
            print(f"[INFO] 임베딩 기반 핵심 키워드 추출: {len(embedding_based_keywords)}개")
            print(f"[DEBUG] 상위 키워드: {embedding_based_keywords}")

        # 의미 키워드 확장 (LLM 생성 - 기존 호환성 유지)
        top_feats_for_keywords = [pf.to_dict() for pf in panel_features_list[:10]]

        parsed_query = result.get('parsed_query', {}) or {}
        base_keywords = parsed_query.get('semantic_keywords') or []
        if not base_keywords:
            base_keywords = [query]

        expanded_keywords = generate_semantic_keywords(
            query=query,
            common_features=common_features,
            top_panel_features=top_feats_for_keywords
        )

        matching_keywords = list(dict.fromkeys(base_keywords + expanded_keywords))

        # 개별 패널 match_reasons 채우기 (상위 N명만)
        for idx, panel in enumerate(top_panels_slice):
            raw_panel = panels[idx] if idx < len(panels) else {}
            features = panel_features_list[idx]
            text_for_reason = str(raw_panel.get('json_doc') or raw_panel.get('content') or '')
            reasons = generate_match_reasons(
                query=query,
                panel_features=features,
                panel_text=text_for_reason,
                score=panel.get('score', 0)
            )
            panel['panel_features'] = features.to_dict()
            panel['match_reasons'] = reasons

        # 키워드 (기존 필드와 호환)
        keywords = matching_keywords or base_keywords
        
        # AI 요약 생성 (간단한 통계 기반)
        summary_parts = []
        if stats['count'] > 0:
            # 주요 연령대
            age_groups: Dict[str, int] = {}
            for panel in transformed_panels:
                if panel['age']:
                    decade = (panel['age'] // 10) * 10
                    age_key = f'{decade}대'
                    age_groups[age_key] = age_groups.get(age_key, 0) + 1
            
            if age_groups:
                main_age = max(age_groups.items(), key=lambda x: x[1])[0]
                summary_parts.append(f'{main_age} 비율이 높으며')
            
            # 주요 지역
            regions: Dict[str, int] = {}
            for panel in transformed_panels:
                if panel['region']:
                    main_region = panel['region'].split()[0] if ' ' in panel['region'] else panel['region']
                    regions[main_region] = regions.get(main_region, 0) + 1
            
            if regions:
                main_region = max(regions.items(), key=lambda x: x[1])[0]
                summary_parts.append(f'{main_region} 지역에 집중되어 있습니다.')
            
            # 평균 점수
            if stats['avg'] >= 70:
                summary_parts.append(f'평균 Match Score는 {stats["avg"]}%로 높은 수준입니다.')
        
        summary = ' '.join(summary_parts) if summary_parts else '의미 기반 검색 결과입니다.'

        # 고급 의미 검색용 확장 응답 (기존 필드는 그대로 유지)
        response = {
            'query': query,
            'keywords': keywords,
            'summary': summary,
            'stats': stats,
            'panels': transformed_panels,
            # 신규 필드
            'matching_keywords': matching_keywords,
            'embedding_based_keywords': embedding_based_keywords,  # ★ 임베딩 결과 기반 키워드
            'common_features': common_features,
            'summary_sentence': summary,
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] 의미 기반 검색 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{error_trace}")
        return jsonify({
            'error': str(e),
            'type': type(e).__name__
        }), 500



