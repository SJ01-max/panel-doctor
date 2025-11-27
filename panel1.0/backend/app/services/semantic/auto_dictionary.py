"""
자동 사전 생성 모듈
- LLM + Embedding 기반으로 질의의 의미를 확장한 단어 리스트 생성
"""

from typing import List
from app.services.llm.client import LlmService
from app.services.data.vector import VectorSearchService


AUTO_DICTIONARY_PROMPT = """당신은 의미 기반 검색 엔진의 용어 확장 전문가입니다.

아래 질의(query)가 의미하는 '핵심 개념 / 관련 대상 / 하위 개념 / 관련 행동 / 대표 키워드'를 30개 생성해주세요.

규칙:
- 단어는 단수 명사 또는 짧은 구문 형태로 (예: "아이폰", "프리미엄 기기", "모바일 앱")
- 질의의 의미를 확장하되, 너무 일반적인 단어는 피하세요
- 한국어로 작성하세요
- JSON 배열 형태로만 출력하세요

예시:
질의: "아이폰을 쓰는 사람"
출력: ["아이폰", "애플", "iOS", "프리미엄 스마트폰", "모바일 기기", "앱 사용", "디지털 서비스", "테크 제품", "스마트폰 브랜드", "모바일 플랫폼", ...]

질의: {{query}}

출력 (JSON 배열만):"""


def generate_expanded_keywords(
    query: str,
    use_llm: bool = True,
    use_embedding: bool = True,
    core_dictionary: List[str] | None = None
) -> List[str]:
    """
    질의 기반 확장 키워드 생성
    
    Args:
        query: 자연어 질의
        use_llm: LLM 기반 확장 사용 여부
        use_embedding: Embedding 기반 유사 단어 추가 사용 여부
        core_dictionary: 핵심 사전 (있으면 조합)
    
    Returns:
        확장된 키워드 리스트 (20~50개)
    """
    expanded: List[str] = []
    
    # 1. LLM 기반 확장
    if use_llm:
        try:
            llm_service = LlmService()
            prompt = AUTO_DICTIONARY_PROMPT.replace("{{query}}", query)
            
            response = llm_service.client.messages.create(
                model=llm_service.get_default_model(),
                max_tokens=1024,
                temperature=0,  # 일관된 키워드 생성을 위해 0으로 변경
                system="당신은 의미 기반 검색 엔진의 용어 확장 전문가입니다. JSON 배열만 출력하세요.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # response.content는 리스트이므로 텍스트 추출
            text = ""
            for block in response.content:
                if hasattr(block, "type") and block.type == "text":
                    text += getattr(block, "text", "")
            
            # JSON 배열 파싱
            import json
            import re
            
            # JSON 배열 추출
            json_match = re.search(r'\[.*?\]', text, re.DOTALL)
            if json_match:
                try:
                    llm_keywords = json.loads(json_match.group(0))
                    if isinstance(llm_keywords, list):
                        expanded.extend([str(kw).strip() for kw in llm_keywords if kw])
                except Exception as e:
                    print(f"[WARN] LLM 키워드 파싱 실패: {e}")
            
            print(f"[INFO] LLM 기반 확장 키워드: {len(expanded)}개")
        except Exception as e:
            print(f"[WARN] LLM 기반 확장 실패: {e}")
    
    # 2. Embedding 기반 유사 단어 추가
    if use_embedding and len(expanded) < 30:
        try:
            vector_service = VectorSearchService()
            
            # 확장된 키워드들을 embedding으로 변환하여 유사 단어 찾기
            # 간단히: query embedding과 유사한 단어를 찾는 대신, 
            # 기존 키워드들을 embedding으로 변환하여 유사 단어 후보 생성
            # (실제로는 키워드 DB나 word2vec 모델이 필요하지만, 여기서는 간단히 처리)
            
            # query 자체를 embedding으로 변환하여 유사한 의미의 단어 찾기
            # 실제 구현에서는 키워드 임베딩 DB가 필요하지만, 여기서는 스킵
            print(f"[INFO] Embedding 기반 확장 (현재는 스킵 - 키워드 DB 필요)")
        except Exception as e:
            print(f"[WARN] Embedding 기반 확장 실패: {e}")
    
    # 3. 핵심 사전 조합
    if core_dictionary:
        expanded.extend(core_dictionary)
    
    # 4. 중복 제거 및 정리
    unique_expanded = []
    seen = set()
    for kw in expanded:
        kw_clean = kw.strip().lower()
        if kw_clean and kw_clean not in seen:
            seen.add(kw_clean)
            unique_expanded.append(kw.strip())
    
    # 5. 최종 리스트 (20~50개로 제한)
    final_list = unique_expanded[:50]
    
    print(f"[INFO] 최종 확장 키워드: {len(final_list)}개")
    return final_list

