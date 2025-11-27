"""
개별 패널의 Match Reason(매칭 근거) 생성 모듈.
LLM에게 질의/특징/텍스트/점수를 전달하여 bullet 형식의 한국어 설명을 생성한다.
"""

from __future__ import annotations

from typing import Any, Dict, List
import json

from app.services.llm.client import LlmService
from app.services.semantic.features import PanelFeatures


MATCH_REASON_SYSTEM_PROMPT = """당신은 의미 기반 추천 시스템의 '설명 가능한 AI' 모듈입니다.
아래 데이터는 특정 패널이 질의(query)와 높은 유사도를 갖는 이유입니다.

- query: {{query}}
- panelFeatures: {{panelFeatures}}
- panelAffinity: {{affinity}}
- brandAffinity: {{brand_affinity}}
- latentTraits: {{latent_traits}}
- panelText: {{panel_text}}

⚠️ **중요 규칙**:
1. 질문에 키워드가 들어갔다고 해서 매칭 근거로 쓰지 마세요.
2. 반드시 **답변 내용**을 확인하고, 질의와 일치하는 답변만 매칭 근거로 사용하세요.
3. 예를 들어:
   - 질의: "반려동물을 좋아하는 사람"
   - 질문: "반려동물을 키워본 적이 있나요?"
   - 답변: "반려동물을 키워본 적 없다" → ❌ 매칭 근거로 사용하면 안 됨
   - 답변: "반려동물을 키워본 적 있다" 또는 "반려동물을 좋아한다" → ✅ 매칭 근거로 사용 가능
4. 질문에 키워드가 있어도 답변이 부정적이거나 질의와 반대되면 매칭 근거로 사용하지 마세요.

이 정보를 바탕으로,
왜 이 패널이 높은 점수를 받았는지 '의미 기반 이유'를 3~5개 bullet로 생성하세요.

⚠️ **매우 중요한 규칙**:
- 질의(query)와 직접 관련된 답변 내용만 매칭 근거로 사용하세요
- 질의에 없는 주제(예: 질의가 "반려동물"인데 "아이폰", "직업" 등)는 절대 포함하지 마세요
- 인구통계 정보(성별, 나이, 지역)는 절대 포함하지 마세요
- 질의와 무관한 제품 소유 정보(예: "냉장고", "세탁기" 등)는 질의와 관련이 있을 때만 포함하세요

작성 규칙:
- 명확한 행동/취향/패턴 기반으로 설명
- 단순 키워드 복붙 금지
- "아이폰을 사용함" 같은 단일 팩트가 아니라 '기기 선택 성향'을 설명
- 예: "프리미엄 디지털 기기 선호 성향", "테크 지출 및 서비스 이용률 높음"
- 한 bullet은 5~20글자 내외
- **반드시 답변 내용을 확인하고, 질의와 일치하는 답변만 사용하세요**
- **절대 인구통계 정보(성별, 나이, 지역)를 매칭 근거로 사용하지 마세요**
- **질의와 직접 관련된 실제 답변 내용만 매칭 근거로 사용하세요**
- 예: 질의가 "반려동물을 좋아하는 20대"인 경우, "반려동물을 키워본 적이 있다" 같은 답변만 표시
- "성별: 남", "나이: 27세", "지역: 경기" 같은 인구통계 정보는 매칭 근거가 아닙니다

출력 형식:
JSON만 출력하세요. 다른 설명은 쓰지 마세요.

예시:
{{
  "match_reasons": ["프리미엄 디지털 기기 선호 성향", "테크 구독 서비스 사용 경험 있음"]
}}
"""


def generate_match_reasons(
  query: str,
  panel_features: PanelFeatures,
  panel_text: str,
  score: int | float,
  model: str | None = None,
) -> List[str]:
  """
  단일 패널에 대한 match_reasons 생성.
  query embedding, TF-IDF category affinity, brand affinity, latent traits를 모두 고려.
  LLM 호출 실패 시에는 빈 리스트를 반환한다.
  """
  llm = LlmService()
  if not model:
    model = llm.get_default_model()

  features_dict = panel_features.to_dict()
  features_json = json.dumps(features_dict, ensure_ascii=False)
  
  # affinity 정보 추출
  affinity = features_dict.get("keyword_affinity", {})
  brand_affinity = features_dict.get("brand_affinity", {})
  latent_traits = features_dict.get("latent_traits", [])

  # panel_text에서 질문과 답변을 구분할 수 있도록 전달
  panel_text_preview = panel_text[:2000] if panel_text else ""  # 너무 길면 잘라서 전달
  
  user_content = (
    f"query: {query}\n"
    f"panelFeatures: {features_json}\n"
    f"panelAffinity: {json.dumps(affinity, ensure_ascii=False)}\n"
    f"brandAffinity: {json.dumps(brand_affinity, ensure_ascii=False)}\n"
    f"latentTraits: {json.dumps(latent_traits, ensure_ascii=False)}\n"
    f"score: {score}\n"
    f"panelText (질문과 답변 포함):\n{panel_text_preview}\n\n"
    "⚠️ 중요: panelText에서 질문에 키워드가 있어도, 반드시 답변 내용을 확인하세요. "
    "답변이 질의와 일치하는 경우만 match_reasons에 포함하세요. "
    "답변이 부정적이거나 질의와 반대되면 match_reasons에 포함하지 마세요.\n\n"
    "⚠️ 절대 금지: 인구통계 정보(성별, 나이, 지역, 출생년도 등)를 match_reasons에 포함하지 마세요. "
    "이런 정보는 질의와의 유사도와 무관합니다. "
    "오직 질의와 직접 관련된 실제 답변 내용(행동, 취향, 선호도 등)만 매칭 근거로 사용하세요.\n\n"
    "위 정보를 분석해서 match_reasons 배열만 포함된 JSON을 반환하세요."
  )

  response = llm.client.messages.create(
    model=model,
    max_tokens=512,
    temperature=0,
    system=MATCH_REASON_SYSTEM_PROMPT,
    messages=[{"role": "user", "content": user_content}],
  )

  text = "\n".join(
    getattr(c, "text", "") for c in getattr(response, "content", []) if getattr(c, "type", None) == "text"
  )

  # JSON 부분만 파싱
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

    reasons = obj.get("match_reasons") or obj.get("reasons") or []
    if isinstance(reasons, list):
      return [str(r).strip() for r in reasons if str(r).strip()]
  except Exception as e:  # noqa: F841
    # 실패 시 로깅만 하고 빈 리스트 반환
    print(f"[WARN] match_reasons 파싱 실패: {e}")

  return []



