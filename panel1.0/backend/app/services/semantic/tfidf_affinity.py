"""
TF-IDF 기반 Category Affinity 계산 모듈
"""

from typing import List, Dict
from collections import Counter
import math


def calculate_tfidf_affinity(
    panel_texts: List[str],
    expanded_keywords: List[str]
) -> Dict[str, float]:
    """
    TF-IDF 기반 키워드 affinity 계산
    
    Args:
        panel_texts: 패널 응답 텍스트 리스트
        expanded_keywords: 확장된 키워드 리스트
    
    Returns:
        { keyword: tfidf_score } 형태의 affinity map (상위 50개)
    """
    if not panel_texts or not expanded_keywords:
        return {}
    
    # 1. 문서 집합 준비
    documents = [text.lower() if text else "" for text in panel_texts]
    keywords_lower = [kw.lower() for kw in expanded_keywords]
    
    # 2. TF 계산 (각 문서에서 키워드 빈도)
    term_freqs: Dict[str, Dict[int, int]] = {}  # {keyword: {doc_id: count}}
    doc_lengths: Dict[int, int] = {}  # {doc_id: total_terms}
    
    for doc_id, doc in enumerate(documents):
        words = doc.split()
        doc_lengths[doc_id] = len(words)
        
        word_counts = Counter(words)
        
        for keyword in keywords_lower:
            # 키워드가 단어에 포함되는지 확인 (부분 매칭)
            keyword_parts = keyword.split()
            count = 0
            
            if len(keyword_parts) == 1:
                # 단일 단어: 정확히 일치하거나 포함
                count = sum(1 for w in words if keyword in w or w in keyword)
            else:
                # 구문: 연속된 단어로 매칭
                for i in range(len(words) - len(keyword_parts) + 1):
                    if words[i:i+len(keyword_parts)] == keyword_parts:
                        count += 1
            
            if count > 0:
                if keyword not in term_freqs:
                    term_freqs[keyword] = {}
                term_freqs[keyword][doc_id] = count
    
    # 3. IDF 계산
    total_docs = len(documents)
    idf_scores: Dict[str, float] = {}
    
    for keyword in keywords_lower:
        docs_with_keyword = len(term_freqs.get(keyword, {}))
        if docs_with_keyword > 0:
            idf_scores[keyword] = math.log(total_docs / docs_with_keyword)
        else:
            idf_scores[keyword] = 0.0
    
    # 4. TF-IDF 계산 및 합산
    affinity_scores: Dict[str, float] = {}
    
    for keyword in keywords_lower:
        tfidf_sum = 0.0
        
        for doc_id, tf in term_freqs.get(keyword, {}).items():
            doc_length = doc_lengths.get(doc_id, 1)
            # 정규화된 TF (단어 빈도 / 문서 길이)
            normalized_tf = tf / doc_length if doc_length > 0 else 0
            idf = idf_scores.get(keyword, 0.0)
            tfidf_sum += normalized_tf * idf
        
        if tfidf_sum > 0:
            affinity_scores[keyword] = tfidf_sum
    
    # 5. 상위 50개만 반환 (score 정렬)
    sorted_affinity = sorted(
        affinity_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )[:50]
    
    return dict(sorted_affinity)

