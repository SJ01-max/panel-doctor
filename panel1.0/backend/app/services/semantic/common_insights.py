"""
상위 N개 패널의 공통 특징을 요약하는 모듈.
"""

from __future__ import annotations

from typing import List, Dict, Any
import json

from app.services.llm.client import LlmService
from app.services.semantic.features import PanelFeatures


COMMON_FEATURES_SYSTEM_PROMPT = """당신은 인구통계·소비·라이프스타일 패널 데이터 분석 전문가입니다.

다음은 검색 결과 상위 패널 50명의 공통 특징입니다.
이 숫자 기반 특징들을 바탕으로, 의미 기반 '공통 성향 요약'을 4~6개 bullet로 생성하세요.

조건:
- 단순 키워드 나열이 아니라 행동·소비·선호 패턴 중심
- 예: "디지털 서비스 의존도 높음", "프리미엄 브랜드 구매 비율 높음"
- 너무 단순한 나이/성별 정보 나열 금지
- 숫자 기반 특징(affinity, score 등)을 의미로 해석

출력 형식:
JSON만 출력하세요.

예시:
{{
  "common_features": ["디지털 서비스 의존도 높음", "프리미엄 브랜드 선호 성향"]
}}
"""


def generate_common_features(
  features_list: List[PanelFeatures],
  model: str | None = None,
) -> List[str]:
  """
  상위 패널들의 PanelFeatures 리스트를 받아 공통 성향 bullet 리스트를 생성.
  """
  if not features_list:
    return []

  llm = LlmService()
  if not model:
    model = llm.get_default_model()

  # 숫자 기반 특징 요약 생성 (평균/중앙값 계산)
  serialized = [f.to_dict() for f in features_list]
  
  # 통계 요약 생성
  summary_stats = {}
  if serialized:
    # keyword_affinity 평균
    all_keywords = {}
    all_brands = {}
    all_car_types = {}
    all_latent_traits = []
    
    for feat in serialized:
      # keyword_affinity 합산
      for kw, score in feat.get("keyword_affinity", {}).items():
        all_keywords[kw] = all_keywords.get(kw, 0) + score
      # brand_affinity 합산
      for brand, score in feat.get("brand_affinity", {}).items():
        all_brands[brand] = all_brands.get(brand, 0) + score
      # car_type_affinity 합산
      for car_type, score in feat.get("car_type_affinity", {}).items():
        all_car_types[car_type] = all_car_types.get(car_type, 0) + score
      # latent_traits 수집
      all_latent_traits.extend(feat.get("latent_traits", []))
    
    # 평균 계산
    n = len(serialized)
    summary_stats = {
      "avg_keyword_affinity": {k: v/n for k, v in sorted(all_keywords.items(), key=lambda x: x[1], reverse=True)[:10]},
      "avg_brand_affinity": {k: v/n for k, v in sorted(all_brands.items(), key=lambda x: x[1], reverse=True)[:10]},
      "avg_car_type_affinity": {k: v/n for k, v in sorted(all_car_types.items(), key=lambda x: x[1], reverse=True)[:10]},
      "common_latent_traits": list(set(all_latent_traits))[:10],
      "panel_count": n
    }
  
  features_json = json.dumps(serialized[:20], ensure_ascii=False)  # 상위 20개만 전달
  stats_json = json.dumps(summary_stats, ensure_ascii=False)

  user_content = (
    f"allPanelFeatures (상위 20개): {features_json[:4000]}\n"
    f"통계 요약: {stats_json}\n\n"
    "위 숫자 기반 특징들을 바탕으로 common_features 배열만 포함된 JSON을 반환하세요."
  )

  response = llm.client.messages.create(
    model=model,
    max_tokens=512,
    temperature=0,
    system=COMMON_FEATURES_SYSTEM_PROMPT,
    messages=[{"role": "user", "content": user_content}],
  )

  text = "\n".join(
    getattr(c, "text", "") for c in getattr(response, "content", []) if getattr(c, "type", None) == "text"
  )

  try:
    import json as json_lib

    if "```json" in text:
      text = text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in text:
      parts = text.split("```")
      if len(parts) >= 3:
        text = parts[1].strip()

    json_start = text.find("{")
    json_end = text.rfind("}")
    if json_start != -1 and json_end != -1 and json_end > json_start:
      obj = json_lib.loads(text[json_start : json_end + 1])
    else:
      obj = json_lib.loads(text)

    common = obj.get("common_features") or obj.get("features") or []
    if isinstance(common, list):
      return [str(c).strip() for c in common if str(c).strip()]
  except Exception as e:  # noqa: F841
    print(f"[WARN] common_features 파싱 실패: {e}")

  return []



