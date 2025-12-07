"""
TF-IDF 기반 Category Affinity 계산 모듈
scikit-learn 기반 최적화 버전
"""

from typing import List, Dict
import re

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("[WARN] scikit-learn이 설치되지 않았습니다. 기본 구현을 사용합니다.")


def _custom_tokenizer(text: str) -> List[str]:
    """
    커스텀 토크나이저: 한국어 + 영문 + 숫자 추출
    부분 매칭을 위해 원본 텍스트도 반환
    """
    # 2글자 이상인 한국어/영문/숫자 토큰 추출
    tokens = re.findall(r'[가-힣a-zA-Z0-9]{2,}', text.lower())
    return tokens


def _check_keyword_match(text: str, keyword: str) -> float:
    """
    키워드가 텍스트에 나타나는지 확인 (부분 매칭 지원)
    반환값: 매칭 강도 (1.0: 정확히 일치, 0.5: 부분 포함)
    """
    text_lower = text.lower()
    keyword_lower = keyword.lower()
    
    # 정확히 일치
    if keyword_lower == text_lower:
        return 1.0
    
    # 구문인 경우: 연속된 단어로 매칭
    if ' ' in keyword_lower:
        keyword_parts = keyword_lower.split()
        text_words = text_lower.split()
        
        # 연속된 단어로 매칭 확인
        for i in range(len(text_words) - len(keyword_parts) + 1):
            if text_words[i:i+len(keyword_parts)] == keyword_parts:
                return 1.0
    
    # 부분 포함 (단어 단위)
    if keyword_lower in text_lower:
        # 단어 경계에서 매칭되는지 확인
        words = text_lower.split()
        for word in words:
            if keyword_lower in word or word in keyword_lower:
                return 0.7  # 부분 매칭은 가중치 낮춤
    
    return 0.0


def calculate_tfidf_affinity(
    panel_texts: List[str],
    expanded_keywords: List[str]
) -> Dict[str, float]:
    """
    TF-IDF 기반 키워드 affinity 계산 (scikit-learn 기반)
    
    Args:
        panel_texts: 패널 응답 텍스트 리스트
        expanded_keywords: 확장된 키워드 리스트
    
    Returns:
        { keyword: tfidf_score } 형태의 affinity map (상위 50개)
    """
    if not panel_texts or not expanded_keywords:
        return {}
    
    # scikit-learn이 없으면 기본 구현 사용 (fallback)
    if not SKLEARN_AVAILABLE:
        return _calculate_tfidf_affinity_fallback(panel_texts, expanded_keywords)
    
    try:
        # 1. 키워드를 vocabulary로 변환 (소문자, 공백 제거)
        keywords_lower = [kw.lower().strip() for kw in expanded_keywords if kw and kw.strip()]
        
        if not keywords_lower:
            return {}
        
        # 2. scikit-learn TfidfVectorizer 사용
        # ngram_range를 (1, 3)으로 설정하여 단어와 구문 모두 지원
        vectorizer = TfidfVectorizer(
            vocabulary=keywords_lower,  # 특정 키워드만 추출
            tokenizer=_custom_tokenizer,  # 커스텀 토크나이저 (한국어 + 영문 + 숫자)
            token_pattern=None,  # tokenizer 사용 시 token_pattern은 무시되므로 명시적으로 None 설정
            lowercase=True,
            ngram_range=(1, 3),  # 1-gram, 2-gram, 3-gram 지원 (구문 매칭)
            min_df=1,  # 최소 1개 문서에 나타나야 함
            max_df=1.0,  # 모든 문서에 나타나도 OK
            norm='l2',  # L2 정규화
            sublinear_tf=True  # TF에 log 적용 (자주 나타나는 단어의 영향 완화)
        )
        
        # 3. TF-IDF 계산
        # 빈 텍스트는 공백으로 대체 (scikit-learn이 빈 문자열을 처리하지 못함)
        documents = [text if text and text.strip() else " " for text in panel_texts]
        
        try:
            tfidf_matrix = vectorizer.fit_transform(documents)
        except ValueError as e:
            # vocabulary에 매칭되는 단어가 없을 수 있음
            print(f"[WARN] TF-IDF 계산 실패 (vocabulary 매칭 없음): {e}")
            return _calculate_tfidf_affinity_fallback(panel_texts, expanded_keywords)
        
        # 4. 각 키워드별 점수 집계
        affinity_scores: Dict[str, float] = {}
        feature_names = vectorizer.get_feature_names_out()
        
        for keyword in expanded_keywords:
            kw_lower = keyword.lower().strip()
            if not kw_lower:
                continue
            
            # scikit-learn에서 계산된 점수 사용
            if kw_lower in feature_names:
                try:
                    col_idx = list(feature_names).index(kw_lower)
                    # 해당 키워드의 모든 문서 점수 합산
                    scores = tfidf_matrix[:, col_idx].toarray().flatten()
                    total_score = float(scores.sum())
                    
                    # 부분 매칭 보정: scikit-learn이 놓친 부분 매칭 추가 계산
                    # (구문이나 부분 포함된 경우)
                    partial_match_bonus = 0.0
                    for doc_idx, doc_text in enumerate(panel_texts):
                        match_strength = _check_keyword_match(doc_text, keyword)
                        if match_strength > 0 and scores[doc_idx] == 0:
                            # scikit-learn이 놓친 부분 매칭에 대해 보너스 점수 추가
                            partial_match_bonus += match_strength * 0.3  # 부분 매칭은 가중치 낮춤
                    
                    total_score += partial_match_bonus
                    
                    if total_score > 0:
                        affinity_scores[keyword] = total_score
                except (ValueError, IndexError):
                    # 키워드가 vocabulary에 없으면 부분 매칭만으로 점수 계산
                    partial_score = 0.0
                    for doc_text in panel_texts:
                        match_strength = _check_keyword_match(doc_text, keyword)
                        if match_strength > 0:
                            partial_score += match_strength
                    
                    if partial_score > 0:
                        affinity_scores[keyword] = partial_score * 0.5  # 부분 매칭만 있으면 가중치 낮춤
        
        # 5. 상위 50개만 반환 (score 정렬)
        sorted_affinity = sorted(
            affinity_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )[:50]
        
        return dict(sorted_affinity)
        
    except Exception as e:
        print(f"[WARN] scikit-learn TF-IDF 계산 실패, fallback 사용: {e}")
        import traceback
        traceback.print_exc()
        return _calculate_tfidf_affinity_fallback(panel_texts, expanded_keywords)


def _calculate_tfidf_affinity_fallback(
    panel_texts: List[str],
    expanded_keywords: List[str]
) -> Dict[str, float]:
    """
    Fallback: scikit-learn이 없을 때 사용하는 기본 구현
    """
    from collections import Counter
    import math
    
    if not panel_texts or not expanded_keywords:
        return {}
    
    documents = [text.lower() if text else "" for text in panel_texts]
    keywords_lower = [kw.lower() for kw in expanded_keywords]
    
    # TF 계산
    term_freqs: Dict[str, Dict[int, int]] = {}
    doc_lengths: Dict[int, int] = {}
    
    for doc_id, doc in enumerate(documents):
        words = doc.split()
        doc_lengths[doc_id] = len(words)
        
        for keyword in keywords_lower:
            keyword_parts = keyword.split()
            count = 0
            
            if len(keyword_parts) == 1:
                count = sum(1 for w in words if keyword in w or w in keyword)
            else:
                for i in range(len(words) - len(keyword_parts) + 1):
                    if words[i:i+len(keyword_parts)] == keyword_parts:
                        count += 1
            
            if count > 0:
                if keyword not in term_freqs:
                    term_freqs[keyword] = {}
                term_freqs[keyword][doc_id] = count
    
    # IDF 계산
    total_docs = len(documents)
    idf_scores: Dict[str, float] = {}
    
    for keyword in keywords_lower:
        docs_with_keyword = len(term_freqs.get(keyword, {}))
        if docs_with_keyword > 0:
            idf_scores[keyword] = math.log(total_docs / docs_with_keyword)
        else:
            idf_scores[keyword] = 0.0
    
    # TF-IDF 계산
    affinity_scores: Dict[str, float] = {}
    
    for keyword in keywords_lower:
        tfidf_sum = 0.0
        
        for doc_id, tf in term_freqs.get(keyword, {}).items():
            doc_length = doc_lengths.get(doc_id, 1)
            normalized_tf = tf / doc_length if doc_length > 0 else 0
            idf = idf_scores.get(keyword, 0.0)
            tfidf_sum += normalized_tf * idf
        
        if tfidf_sum > 0:
            affinity_scores[keyword] = tfidf_sum
    
    sorted_affinity = sorted(
        affinity_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )[:50]
    
    return dict(sorted_affinity)

