"""
검색 질의와 패널 공통 특징을 기반으로 의미 키워드 세트를 확장 생성하는 모듈.
"""

from __future__ import annotations

from typing import List
import json

from app.services.llm.client import LlmService


SEMANTIC_KEYWORDS_SYSTEM_PROMPT = """아래 질의(query)와 상위 패널들의 특징을 기반으로,
사용자가 의도한 의미를 대표하는 '5~8개의 의미 키워드'를 추출하세요.

- query: {{query}}
- common_features: {{commonFeatures}}
- panel_features: {{topPanelFeatures}}

출력 형식:
JSON만 출력하세요. 예:
["아이폰", "프리미엄 선호", "디지털 기기 활용", "테크 관심도", "서비스 구독 경험"]
"""


def generate_semantic_keywords(
  query: str,
  common_features: List[str],
  top_panel_features: List[dict],
  model: str | None = None,
) -> List[str]:
  llm = LlmService()
  if not model:
    model = llm.get_default_model()

  cf_json = json.dumps(common_features, ensure_ascii=False)
  pf_json = json.dumps(top_panel_features, ensure_ascii=False)

  user_content = (
    f"query: {query}\ncommonFeatures: {cf_json}\npanelFeatures: {pf_json[:4000]}\n\n"
    "위 정보를 바탕으로 의미 키워드 문자열 배열(JSON)만 반환하세요."
  )

  response = llm.client.messages.create(
    model=model,
    max_tokens=256,
    temperature=0,
    system=SEMANTIC_KEYWORDS_SYSTEM_PROMPT,
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

    arr = json_lib.loads(text)
    if isinstance(arr, list):
      return [str(k).strip() for k in arr if str(k).strip()]
  except Exception as e:  # noqa: F841
    print(f"[WARN] semantic keywords 파싱 실패: {e}")

  return []



