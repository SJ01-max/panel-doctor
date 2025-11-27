"""
패널 Feature Vector 및 설명용 Feature Set 추출 모듈

- PanelFeatures: 설명 가능한 feature 구조
- extract_panel_features: DB row 및 json_doc에서 PanelFeatures 생성
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional
import json
import math


@dataclass
class CategoryAffinity:
  beauty: float | None = None
  finance: float | None = None
  gaming: float | None = None
  food: float | None = None
  fashion: float | None = None
  travel: float | None = None


@dataclass
class SentimentProfile:
  positive_ratio: float | None = None
  stress_ratio: float | None = None
  purchase_intent: float | None = None


@dataclass
class PanelFeatures:
  # 기본 demographic
  age: Optional[int] = None
  gender: Optional[str] = None
  region: Optional[str] = None
  
  # 기존 features
  device_brand: Optional[str] = None
  lifestyle_tags: List[str] = field(default_factory=list)
  spending_level: Optional[str] = None
  tech_usage_level: Optional[float] = None  # 0~1
  category_affinity: CategoryAffinity = field(default_factory=CategoryAffinity)
  sentiment_profile: SentimentProfile = field(default_factory=SentimentProfile)
  
  # 자동 affinity features (TF-IDF 기반)
  keyword_affinity: Dict[str, float] = field(default_factory=dict)  # {keyword: tfidf_score}
  brand_affinity: Dict[str, float] = field(default_factory=dict)  # {brand: score}
  car_type_affinity: Dict[str, float] = field(default_factory=dict)  # {car_type: score}
  lifestyle_affinity: Dict[str, float] = field(default_factory=dict)  # {lifestyle: score}
  
  # LLM 기반 latent traits
  latent_traits: List[str] = field(default_factory=list)  # ["프리미엄 지출", "테크 관심도", ...]

  def to_dict(self) -> Dict[str, Any]:
    data = asdict(self)
    return data


def _safe_float(value: Any) -> Optional[float]:
  try:
    f = float(value)
    if math.isnan(f):
      return None
    return f
  except Exception:
    return None


def _load_json_doc(panel_row: Dict[str, Any]) -> Dict[str, Any]:
  raw = panel_row.get("json_doc")
  if not raw:
    return {}
  if isinstance(raw, dict):
    return raw
  try:
    return json.loads(raw)
  except Exception:
    return {}


def _infer_device_brand(json_doc: Dict[str, Any]) -> Optional[str]:
  text_blob = json.dumps(json_doc, ensure_ascii=False)
  text_blob_lower = text_blob.lower()
  if "iphone" in text_blob_lower or "ios" in text_blob_lower or "애플" in text_blob:
    return "Apple"
  if "galaxy" in text_blob_lower or "android" in text_blob_lower or "삼성" in text_blob:
    return "Samsung"
  return None


def _infer_lifestyle_tags(json_doc: Dict[str, Any]) -> List[str]:
  text = json.dumps(json_doc, ensure_ascii=False)
  tags: List[str] = []
  if any(k in text for k in ["헬스", "운동", "피트니스", "헬스장"]):
    tags.append("fitness")
  if any(k in text for k in ["프리미엄", "명품", "하이엔드", "고가"]):
    tags.append("premium")
  if any(k in text for k in ["게임", "콘솔", "PC방"]):
    tags.append("gaming")
  if any(k in text for k in ["여행", "항공", "호텔", "에어비앤비"]):
    tags.append("travel")
  if any(k in text for k in ["뷰티", "화장품", "스킨케어"]):
    tags.append("beauty")
  # 중복 제거
  return list(dict.fromkeys(tags))


def _infer_spending_level(panel_row: Dict[str, Any], json_doc: Dict[str, Any]) -> Optional[str]:
  # 간단한 휴리스틱: 응답 JSON 내 "지출", "소비" 관련 키워드 빈도
  text = json.dumps(json_doc, ensure_ascii=False)
  high_keywords = ["명품", "프리미엄", "고가", "비싼 편"]
  low_keywords = ["가성비", "저렴", "할인만", "쿠폰만"]

  high_score = sum(text.count(k) for k in high_keywords)
  low_score = sum(text.count(k) for k in low_keywords)

  if high_score == 0 and low_score == 0:
    return None
  if high_score > low_score:
    return "high"
  if low_score > high_score:
    return "low"
  return "medium"


def _infer_tech_usage_level(json_doc: Dict[str, Any]) -> Optional[float]:
  text = json.dumps(json_doc, ensure_ascii=False)
  tech_keywords = [
    "앱",
    "모바일",
    "스트리밍",
    "OTT",
    "온라인",
    "구독",
    "디지털",
    "스마트폰",
  ]
  hits = sum(text.count(k) for k in tech_keywords)
  if hits == 0:
    return None
  # 간단 정규화: 0~1 사이
  return min(1.0, hits / 10.0)


def _infer_category_affinity(json_doc: Dict[str, Any]) -> CategoryAffinity:
  text = json.dumps(json_doc, ensure_ascii=False)

  def count_any(keywords: List[str]) -> int:
    return sum(text.count(k) for k in keywords)

  beauty = count_any(["뷰티", "화장품", "스킨케어"])
  finance = count_any(["카드", "예금", "투자", "주식", "펀드"])
  gaming = count_any(["게임", "콘솔", "모바일 게임"])
  food = count_any(["배달", "음식", "식당", "맛집"])
  fashion = count_any(["의류", "패션", "옷", "신발"])
  travel = count_any(["여행", "항공", "호텔", "리조트"])

  total = max(1, beauty + finance + gaming + food + fashion + travel)

  return CategoryAffinity(
    beauty=beauty / total if beauty else None,
    finance=finance / total if finance else None,
    gaming=gaming / total if gaming else None,
    food=food / total if food else None,
    fashion=fashion / total if fashion else None,
    travel=travel / total if travel else None,
  )


def _infer_sentiment_profile(json_doc: Dict[str, Any]) -> SentimentProfile:
  text = json.dumps(json_doc, ensure_ascii=False)

  positive_keywords = ["만족", "좋다", "행복", "즐겁", "기쁘"]
  stress_keywords = ["스트레스", "피곤", "지치", "우울", "불안"]
  intent_keywords = ["구매", "사고 싶", "이용 의향", "사용 의향"]

  def score(words: List[str]) -> int:
    return sum(text.count(w) for w in words)

  pos = score(positive_keywords)
  stress = score(stress_keywords)
  intent = score(intent_keywords)
  total = max(1, pos + stress + intent)

  return SentimentProfile(
    positive_ratio=pos / total if pos else None,
    stress_ratio=stress / total if stress else None,
    purchase_intent=intent / total if intent else None,
  )


def extract_panel_features(
    panel_row: Dict[str, Any],
    expanded_keywords: List[str] | None = None,
    all_panel_texts: List[str] | None = None
) -> PanelFeatures:
  """
  DB에서 읽어온 panel row(dict)를 PanelFeatures 구조로 변환.
  
  Args:
    panel_row: 패널 데이터 row
    expanded_keywords: 확장된 키워드 리스트 (TF-IDF 계산용)
    all_panel_texts: 전체 패널 텍스트 리스트 (TF-IDF 계산용, 선택사항)
  
  Returns:
    PanelFeatures 객체
  """
  json_doc = _load_json_doc(panel_row)
  panel_text = panel_row.get("json_doc") or panel_row.get("content") or ""
  if isinstance(panel_text, dict):
    panel_text = json.dumps(panel_text, ensure_ascii=False)
  elif not isinstance(panel_text, str):
    panel_text = str(panel_text)

  # ① 기본 demographic feature
  age = None
  if panel_row.get("age"):
    age = int(panel_row["age"])
  elif panel_row.get("birth_year"):
    from datetime import datetime
    age = datetime.now().year - int(panel_row["birth_year"])
  
  gender = panel_row.get("gender")
  region = panel_row.get("region")

  # 기존 features
  device_brand = panel_row.get("device_brand") or _infer_device_brand(json_doc)

  lifestyle_tags: List[str] = []
  if panel_row.get("lifestyle_tags"):
    if isinstance(panel_row["lifestyle_tags"], list):
      lifestyle_tags.extend([str(t) for t in panel_row["lifestyle_tags"]])
    else:
      lifestyle_tags.extend(str(panel_row["lifestyle_tags"]).split(","))
  lifestyle_tags.extend(_infer_lifestyle_tags(json_doc))
  lifestyle_tags = list(dict.fromkeys([t.strip() for t in lifestyle_tags if t]))

  spending_level = panel_row.get("spending_level") or _infer_spending_level(panel_row, json_doc)

  tech_usage_level = _safe_float(panel_row.get("tech_usage_level"))
  if tech_usage_level is None:
    tech_usage_level = _infer_tech_usage_level(json_doc)

  cat = CategoryAffinity()
  cat_raw = panel_row.get("category_affinity")
  if isinstance(cat_raw, dict):
    cat = CategoryAffinity(
      beauty=_safe_float(cat_raw.get("beauty")),
      finance=_safe_float(cat_raw.get("finance")),
      gaming=_safe_float(cat_raw.get("gaming")),
      food=_safe_float(cat_raw.get("food")),
      fashion=_safe_float(cat_raw.get("fashion")),
      travel=_safe_float(cat_raw.get("travel")),
    )
  else:
    cat = _infer_category_affinity(json_doc)

  sent = SentimentProfile()
  sent_raw = panel_row.get("sentiment_profile")
  if isinstance(sent_raw, dict):
    sent = SentimentProfile(
      positive_ratio=_safe_float(sent_raw.get("positive_ratio")),
      stress_ratio=_safe_float(sent_raw.get("stress_ratio")),
      purchase_intent=_safe_float(sent_raw.get("purchase_intent")),
    )
  else:
    sent = _infer_sentiment_profile(json_doc)

  # ② 자동 affinity feature (TF-IDF 기반)
  keyword_affinity: Dict[str, float] = {}
  brand_affinity: Dict[str, float] = {}
  car_type_affinity: Dict[str, float] = {}
  lifestyle_affinity: Dict[str, float] = {}
  
  if expanded_keywords and all_panel_texts:
    try:
      from app.services.semantic.tfidf_affinity import calculate_tfidf_affinity
      
      # keyword_affinity 계산 (전체 패널 텍스트로 TF-IDF 계산 후, 현재 패널의 점수만 추출)
      # 전체 문서 집합으로 TF-IDF 계산
      all_keyword_affinity = calculate_tfidf_affinity(all_panel_texts, expanded_keywords)
      
      # 현재 패널 텍스트에서 키워드가 나타나는지 확인하여 점수 추출
      # (간단히: 전체 결과에서 해당 키워드의 TF-IDF 점수를 사용)
      # 더 정확하게는: 현재 패널 텍스트에 키워드가 있으면 전체 TF-IDF 점수를 사용
      panel_text_lower = panel_text.lower()
      keyword_affinity = {}
      for kw, score in all_keyword_affinity.items():
        kw_lower = kw.lower()
        # 키워드가 현재 패널 텍스트에 포함되어 있으면 점수 사용
        if kw_lower in panel_text_lower or any(kw_part in panel_text_lower for kw_part in kw_lower.split()):
          keyword_affinity[kw] = score
      
      # brand_affinity, car_type_affinity는 전체 패널 텍스트로 계산된 결과를 재사용
      # (extract_panel_features에서는 계산하지 않고, SearchService에서 계산한 결과를 사용)
      # 여기서는 빈 딕셔너리로 두고, SearchService에서 전체 결과를 각 패널에 매핑
      brand_affinity = {}
      car_type_affinity = {}
      
      # lifestyle_affinity 계산 (lifestyle_tags 기반)
      if lifestyle_tags:
        all_lifestyle_affinity = calculate_tfidf_affinity(all_panel_texts, lifestyle_tags)
        lifestyle_affinity = {}
        for tag, score in all_lifestyle_affinity.items():
          tag_lower = tag.lower()
          if tag_lower in panel_text_lower:
            lifestyle_affinity[tag] = score
    except Exception as e:
      print(f"[WARN] TF-IDF affinity 계산 실패: {e}")

  # ③ LLM 기반 latent traits (성능 최적화: 선택적 생성)
  # 주의: LLM 호출이 많아 성능 저하가 있으므로, 필요시에만 활성화
  latent_traits: List[str] = []
  # 성능 최적화를 위해 latent_traits 생성은 기본적으로 스킵
  # 필요시 환경변수나 플래그로 활성화 가능
  ENABLE_LATENT_TRAITS = False  # 기본값: False (성능 우선)
  
  if ENABLE_LATENT_TRAITS:
    try:
      from app.services.llm.client import LlmService
      
      llm_service = LlmService()
      latent_prompt = f"""질문 응답들의 전체 의미를 기반으로,
이 패널을 설명하는 '성향·선호·행동 패턴'을 3~5개 키워드 형태로 출력해주세요.

예: ["프리미엄 지출", "테크 관심도", "모바일 서비스 사용량 높음"]

패널 응답 텍스트:
{panel_text[:2000]}

출력 (JSON 배열만):"""
      
      response = llm_service.client.messages.create(
        model=llm_service.get_default_model(),
        max_tokens=256,
        temperature=0.3,
        system="당신은 패널 데이터 분석 전문가입니다. JSON 배열만 출력하세요.",
        messages=[{"role": "user", "content": latent_prompt}]
      )
      
      # response.content는 리스트이므로 텍스트 추출
      text = ""
      for block in response.content:
        if hasattr(block, "type") and block.type == "text":
          text += getattr(block, "text", "")
      import re
      json_match = re.search(r'\[.*?\]', text, re.DOTALL)
      if json_match:
        latent_traits = json.loads(json_match.group(0))
        if isinstance(latent_traits, list):
          latent_traits = [str(t).strip() for t in latent_traits if t]
    except Exception as e:
      print(f"[WARN] latent_traits 생성 실패: {e}")

  return PanelFeatures(
    age=age,
    gender=gender,
    region=region,
    device_brand=device_brand,
    lifestyle_tags=lifestyle_tags,
    spending_level=spending_level,
    tech_usage_level=tech_usage_level,
    category_affinity=cat,
    sentiment_profile=sent,
    keyword_affinity=keyword_affinity,
    brand_affinity=brand_affinity,
    car_type_affinity=car_type_affinity,
    lifestyle_affinity=lifestyle_affinity,
    latent_traits=latent_traits,
  )



