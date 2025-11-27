"""
자동차 브랜드 및 제품군 추출 모듈 (NER + TF-IDF)
"""

from typing import Dict, List
import re
from app.services.semantic.tfidf_affinity import calculate_tfidf_affinity


# 자동차 브랜드 사전
CAR_BRANDS = [
    "현대", "기아", "제네시스", "쌍용", "BMW", "벤츠", "메르세데스", "아우디", "폭스바겐", "볼보",
    "포르쉐", "랜드로버", "재규어", "미니", "테슬라", "렉서스", "인피니티", "닛산", "도요타", "혼다",
    "마쓰다", "미쓰비시", "스바루", "쉐보레", "캐딜락", "지프", "포드", "링컨", "크라이슬러", "닷지",
    "람보르기니", "페라리", "마세라티", "알파로메오", "피아트", "시트로엥", "르노", "푸조", "오펠",
    "스코다", "시트로엥", "세아트", "피아트", "알파로메오"
]

# 차량 모델명 사전 (한국에서 많이 사용되는 차량 모델)
CAR_MODELS = [
    # 현대
    "아반떼", "소나타", "그랜저", "아이오닉", "코나", "투싼", "싼타페", "팰리세이드", "넥쏘", "아이오닉5", "아이오닉6",
    "벨로스터", "엑센트", "아토스", "캐스퍼", "스타리아", "포터", "라보", "마르샤",
    # 기아
    "K3", "K5", "K7", "K8", "K9", "리오", "프라이드", "모닝", "레이", "쏘울", "니로", "스포티지", "쏘렌토", "모하비", "텔루라이드",
    "셀토스", "EV6", "EV9", "카니발", "카렌스", "봉고", "포르테", "옵티마",
    # 제네시스
    "G70", "G80", "G90", "GV70", "GV80", "GV90",
    # BMW
    "3시리즈", "5시리즈", "7시리즈", "X1", "X3", "X5", "X7", "iX", "i4",
    # 벤츠
    "C클래스", "E클래스", "S클래스", "GLA", "GLB", "GLC", "GLE", "GLS", "EQS", "EQC",
    # 아우디
    "A3", "A4", "A6", "A8", "Q3", "Q5", "Q7", "e-tron",
    # 도요타
    "캠리", "프리우스", "RAV4", "랜드크루저", "코롤라", "아발론",
    # 혼다
    "어코드", "시빅", "CR-V", "파일럿", "오딧세이",
    # 닛산
    "알티마", "센트라", "로그", "패스파인더", "리프",
    # 테슬라
    "모델3", "모델Y", "모델S", "모델X",
    # 기타
    "볼보XC90", "볼보XC60", "포르쉐카이엔", "포르쉐마칸", "랜드로버디스커버리", "지프랭글러", "지프그랜드체로키"
]

# 차량 타입 사전 (차종 중심)
CAR_TYPES = [
    # 차종 (Body Type)
    "SUV", "세단", "왜건", "해치백", "쿠페", "컨버터블", "스포츠카", "픽업트럭", "밴", "트럭",
    "리무진", "승합차", "화물차", "경차", "소형차", "준중형", "중형차", "대형차",
    "MPV", "크로스오버", "왜건", "해치백", "로드스터",
    # 연료 타입 (참고용, 차종보다 우선순위 낮음)
    "전기차", "EV", "하이브리드", "수소차", "가솔린", "디젤", "LPG", "플러그인하이브리드", "PHEV",
    # 추가 차종 표현
    "승용차", "화물차", "버스", "택시"
]


def extract_car_entities(
    panel_texts: List[str]
) -> Dict[str, Dict[str, float]]:
    """
    패널 텍스트에서 자동차 브랜드 및 차량 모델명 추출 (TF-IDF 가중치 계산)
    
    Args:
        panel_texts: 패널 응답 텍스트 리스트
    
    Returns:
        {
            "brand_affinity": { "BMW": 0.77, "현대": 0.63, ... },
            "car_type_affinity": { "아반떼": 0.54, "소나타": 0.40, "K5": 0.35, ... }  # 실제 차량 모델명
        }
    """
    if not panel_texts:
        print("[DEBUG] extract_car_entities: panel_texts가 비어있음")
        return {
            "brand_affinity": {},
            "car_type_affinity": {}
        }
    
    print(f"[DEBUG] extract_car_entities: {len(panel_texts)}개 패널 텍스트 처리 시작")
    
    # 1. 브랜드 affinity 계산
    brand_affinity = calculate_tfidf_affinity(panel_texts, CAR_BRANDS)
    print(f"[DEBUG] extract_car_entities: 브랜드 affinity 계산 완료 - {len(brand_affinity)}개")
    
    # 2. 차량 모델명 affinity 계산 (실제 설문 응답에서 언급된 모델명)
    car_model_affinity = calculate_tfidf_affinity(panel_texts, CAR_MODELS)
    print(f"[DEBUG] extract_car_entities: 차량 모델명 affinity 계산 완료 - {len(car_model_affinity)}개")
    
    # 3. 정규화 (0~1 범위로)
    def normalize_scores(scores: Dict[str, float]) -> Dict[str, float]:
        if not scores:
            return {}
        max_score = max(scores.values()) if scores.values() else 1.0
        if max_score == 0:
            return scores
        return {k: min(1.0, v / max_score) for k, v in scores.items()}
    
    brand_affinity = normalize_scores(brand_affinity)
    car_type_affinity = normalize_scores(car_model_affinity)  # 차량 모델명을 car_type_affinity로 사용
    
    print(f"[DEBUG] extract_car_entities: 정규화 완료 - brand: {len(brand_affinity)}개, car_model: {len(car_type_affinity)}개")
    if brand_affinity:
        print(f"[DEBUG] extract_car_entities: brand_affinity 샘플: {list(brand_affinity.items())[:3]}")
    if car_type_affinity:
        print(f"[DEBUG] extract_car_entities: car_model_affinity 샘플: {list(car_type_affinity.items())[:3]}")
    
    return {
        "brand_affinity": brand_affinity,
        "car_type_affinity": car_type_affinity  # 실제 차량 모델명 (아반떼, 소나타, K5 등)
    }

