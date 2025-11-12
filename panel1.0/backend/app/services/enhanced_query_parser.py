"""
개선된 자연어 질의 파서
- 지역 정규화 (17개 광역 단위)
- Claude LLM 기반 구조화 추출
- 패러프레이즈를 통한 베스트 선택
- 커버리지 점수 계산
"""
import re
import json
from typing import Dict, Any, List, Optional
from app.services.llm_service import LlmService


# -----------------------------
# 0) 테이블/컬럼 매핑
# -----------------------------
COL = {
    "table": "core.join_clean",
    "id": "respondent_id",
    "gender": "gender",           # '남'/'여'
    "region": "region",           # DB에는 시/구 단위 값(예: 평택시, 성북구, 남동구 ...)
    "age_text": "age_text",       # 예: "1987년 06월 29일 (만 38 세)"
    "dt": "survey_datetime",      # 기간 필터용 timestamp
    "q_concat": "q_concat"
}

# -----------------------------
# 1) 광역 단위 정규화 (17개만 허용)
# -----------------------------
CANON = {
    "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
    "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"
}

ALIASES = {
    "서울특별시": "서울", "서울시": "서울",
    "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
    "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산",
    "세종특별자치시": "세종", "세종시": "세종",
    "경기도": "경기", "강원도": "강원", "충청북도": "충북", "충청남도": "충남",
    "전라북도": "전북", "전라남도": "전남", "경상북도": "경북", "경상남도": "경남",
    "제주특별자치도": "제주", "제주도": "제주"
}

SUFFIXES = ("특별자치도", "특별자치시", "광역시", "특별시", "자치시", "자치도", "도", "시")


def normalize_top_region(name: str) -> Optional[str]:
    """지역명을 표준 광역 단위로 정규화"""
    if not name:
        return None
    n = "".join(name.split())  # 공백 제거
    # 1) alias 우선
    if n in ALIASES:
        n = ALIASES[n]
    else:
        # 2) 접미사 제거
        for suf in SUFFIXES:
            if n.endswith(suf):
                n = n[:-len(suf)]
                break
    # 3) 최종 검증(17개만 허용)
    return n if n in CANON else None


def normalize_top_regions_in_text(text: str) -> List[str]:
    """자연어 한 줄에서 포함된 광역명을 찾아 표준명 리스트로 반환"""
    found = set()
    t = "".join(text.split())
    # alias 먼저
    for k, v in ALIASES.items():
        if k in t:
            found.add(v)
    # 표준명 직접 포함
    for c in CANON:
        if c in t:
            found.add(c)
    return sorted(found)


# -----------------------------
# 1-b) 성별/기간/인원 간단 정규화
# -----------------------------
GENDER_MAP = {"남": "남", "남자": "남", "남성": "남", "여": "여", "여자": "여", "여성": "여"}
UNIT_MAP = {"일": "days", "주": "weeks", "개월": "months", "달": "months", "년": "years"}


def normalize_age(text: str) -> Dict[str, Any]:
    """연령대/나이 추출"""
    m = re.search(r'(\d{2})\s*대', text)
    if m:
        d = int(m.group(1))
        return {"age_range": [d, d+9]}
    m = re.search(r'만?\s*(\d{1,2})\s*세', text)
    if m:
        a = int(m.group(1))
        return {"age_exact": a}
    return {}


def normalize_gender(text: str) -> Dict[str, Any]:
    """성별 추출"""
    for k, v in GENDER_MAP.items():
        if k in text:
            return {"gender": v}
    return {}


def normalize_limit(text: str) -> Dict[str, Any]:
    """인원 수 추출"""
    m = re.search(r'(\d{1,4})\s*명', text)
    return {"limit": int(m.group(1))} if m else {}


def normalize_time(text: str) -> Dict[str, Any]:
    """기간 추출"""
    m = re.search(r'(지난|최근)\s*(\d+)\s*(일|주|개월|달|년)', text)
    if m:
        return {"time_range": {"recent": int(m.group(2)), "unit": m.group(3)}}
    return {}


def slot_normalize(q: str) -> Dict[str, Any]:
    """규칙 기반 슬롯 추출 (LLM 힌트용)"""
    slots = {}
    # 광역 단위 찾기
    tops = normalize_top_regions_in_text(q)
    if tops:
        slots["top_regions"] = tops
    # 나머지 간단 슬롯
    for part in (normalize_age(q), normalize_gender(q), normalize_limit(q), normalize_time(q)):
        slots.update(part)
    return slots


# -----------------------------
# 2) Claude 구조화 추출 프롬프트
# -----------------------------
SCHEMA_INSTRUCTIONS = """
너는 사용자의 한국어 질의를 아래 JSON 스키마로만 추출한다.
반드시 JSON만 출력하라.

{
  "filters": {
    "top_regions": ["경기","서울"],    // 광역 단위(단일/복수 허용)
    "age_range": [lo, hi],            // 없으면 생략
    "age_exact": 27,                  // 없으면 생략
    "gender": "남" | "여",            // 없으면 생략
    "time_range": {"recent": 3, "unit": "일|주|개월|달|년"}  // 없으면 생략
  },
  "limit": 100,                       // 없으면 생략
  "needs_semantic": true,             // 의미검색(예: '운동 좋아함') 필요?
  "semantic_hint": "운동 좋아함"      // 필요 시 한글 키워드 한두 개로
}

규칙:
- 사용자 지역 입력은 '서울/경기/인천/...' 같은 광역 단위만 인정한다(시/구 미사용).
- 모호하면 보수적으로 추출한다.
- 출력은 반드시 위 JSON 형태만, 추가 문장/코드블럭 금지.
"""


def build_prompt(query: str) -> str:
    """LLM 프롬프트 생성"""
    base = slot_normalize(query)  # seed로 top_regions/age/gender/limit/time 힌트를 제공
    seed = json.dumps({"seed_slots": base}, ensure_ascii=False)
    return f"{SCHEMA_INSTRUCTIONS}\n\n[QUERY]\n{query}\n\n[HINT]\n{seed}"


# -----------------------------
# 3) 광역 -> 시/구 확장 (초기 예시 매핑)
# -----------------------------
TOP_REGION_MAP = {
    "서울": ["강서구", "용산구", "성북구", "강남구", "송파구", "마포구", "종로구", "중구", "영등포구", "서초구"],
    "인천": ["남동구", "부평구", "서구", "연수구", "중구"],
    "경기": ["평택시", "고양시", "오산시", "김포시", "부천시", "성남시", "수원시", "안양시", "안산시", "용인시"],
    "강원": ["원주시", "춘천시", "강릉시"],
    "부산": ["해운대구", "부산진구", "동래구", "남구", "북구"],
    "대구": ["수성구", "달서구", "중구", "동구"],
    "대전": ["유성구", "서구", "중구"],
    "울산": ["남구", "북구", "중구"],
    "세종": [],
    "충북": ["청주시", "충주시"],
    "충남": ["천안시", "아산시", "공주시"],
    "전북": ["전주시", "익산시", "군산시"],
    "전남": ["목포시", "여수시", "순천시"],
    "경북": ["포항시", "구미시", "경주시"],
    "경남": ["창원시", "김해시", "양산시"],
    "광주": ["동구", "서구", "남구"],
    "제주": ["제주시", "서귀포시"]
}


def expand_top_regions(top_regions: List[str]) -> List[str]:
    """광역 단위를 시/구로 확장"""
    out = []
    for tr in top_regions:
        tr_norm = normalize_top_region(tr)
        if not tr_norm:
            continue
        cities = TOP_REGION_MAP.get(tr_norm, [])
        out.extend(c.strip() for c in cities if c.strip())
    return sorted(set(out))  # 중복 제거


# -----------------------------
# 4) SQL 생성 (실제 컬럼 사용)
# -----------------------------
def build_sql(sk: Dict[str, Any]) -> str:
    """구조화된 쿼리에서 SQL 생성"""
    f = sk.get("filters", {})
    where = []

    # age_text에서 "만 XX 세" 숫자만 뽑아 비교
    age_num = f"CAST(SUBSTRING({COL['age_text']} FROM '만\\s+([0-9]+)\\s*세') AS INTEGER)"

    if "age_range" in f:
        lo, hi = f["age_range"]
        where.append(f"({age_num} BETWEEN {lo} AND {hi})")

    if "age_exact" in f:
        where.append(f"({age_num} = {f['age_exact']})")

    # (A) 광역 단위 → 시/구 확장(IN)
    if "top_regions" in f and isinstance(f["top_regions"], list):
        expanded = expand_top_regions(f["top_regions"])
        if expanded:
            safe = ", ".join(f"'{r.replace(chr(39), chr(39)+chr(39))}'" for r in expanded)
            where.append(f"({COL['region']} IN ({safe}))")

    # 성별
    if "gender" in f:
        where.append(f"({COL['gender']} = '{f['gender']}')")  # '남'/'여'

    # 기간
    if "time_range" in f:
        qty = f["time_range"]["recent"]
        unit = f["time_range"]["unit"]        # 일/주/개월/달/년
        pg_unit = UNIT_MAP[unit]
        where.append(f"({COL['dt']} >= NOW() - INTERVAL '{qty} {pg_unit}')")

    # 간단 의미검색(옵션): q_concat ILIKE
    if sk.get("needs_semantic") and sk.get("semantic_hint"):
        hint = sk["semantic_hint"].replace("'", "''")
        where.append(f"({COL['q_concat']} ILIKE '%{hint}%')")

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    limit_sql = f" LIMIT {sk.get('limit', 100)}"
    return f"SELECT {COL['id']} FROM {COL['table']} {where_sql}{limit_sql};"


# -----------------------------
# 5) 커버리지 점수 & 베스트 선택(패러프레이즈 2개)
# -----------------------------
def coverage_score(sk: Dict[str, Any]) -> float:
    """추출된 슬롯의 커버리지 점수 계산"""
    f = sk.get("filters", {})
    score = 0
    tot = 0
    for key in ["age_range", "age_exact", "top_regions", "gender", "time_range"]:
        tot += 1
        if key in f:
            score += 1
    if "limit" in sk:
        tot += 1
        score += 1
    return score / max(tot, 1)


class EnhancedQueryParser:
    """개선된 자연어 질의 파서"""
    
    def __init__(self):
        self.llm_service = LlmService()
    
    def call_llm_structured(self, query: str) -> Dict[str, Any]:
        """Claude LLM을 사용한 구조화 추출"""
        prompt = build_prompt(query)
        
        # Anthropic SDK 사용 (LangChain 대신)
        response = self.llm_service.client.messages.create(
            model=self.llm_service.get_default_model(),
            max_tokens=1024,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}]
        )
        
        # JSON 파싱
        content = response.content[0].text if response.content else ""
        try:
            # JSON만 추출 (코드블럭 제거)
            content = content.strip()
            if content.startswith("```"):
                # 코드블럭 제거
                lines = content.split("\n")
                content = "\n".join(lines[1:-1]) if len(lines) > 2 else content
            elif content.startswith("```json"):
                lines = content.split("\n")
                content = "\n".join(lines[1:-1]) if len(lines) > 2 else content
            
            data = json.loads(content)
            return data
        except json.JSONDecodeError as e:
            # JSON 파싱 실패 시 규칙 기반으로 폴백
            return slot_normalize(query)
    
    def pick_best(self, query: str) -> Dict[str, Any]:
        """패러프레이즈를 통한 베스트 선택"""
        q1 = query.strip()
        q2 = q1.replace("뽑아줘", "추출해줘").replace("보여줘", "조회해줘")
        
        cands = []
        for q in (q1, q2):
            try:
                sk = self.call_llm_structured(q)
                sql = build_sql(sk)
                score = coverage_score(sk)
                cands.append({
                    "score": score,
                    "structured": sk,
                    "sql": sql,
                    "query": q
                })
            except Exception as e:
                # 실패 시 규칙 기반으로 폴백
                sk = slot_normalize(q)
                sql = build_sql(sk)
                score = coverage_score(sk)
                cands.append({
                    "score": score,
                    "structured": sk,
                    "sql": sql,
                    "query": q,
                    "error": str(e)
                })
        
        if not cands:
            # 완전 실패 시 기본값
            return {
                "score": 0.0,
                "structured": slot_normalize(query),
                "sql": build_sql(slot_normalize(query)),
                "query": query
            }
        
        cands.sort(key=lambda x: x["score"], reverse=True)
        return cands[0]
    
    def parse(self, query_text: str) -> Dict[str, Any]:
        """
        자연어 질의를 파싱
        
        Args:
            query_text: 사용자가 입력한 자연어 질의
            
        Returns:
            파싱된 쿼리 딕셔너리
        """
        best = self.pick_best(query_text)
        
        # 기존 형식에 맞게 변환
        structured = best["structured"]
        filters = structured.get("filters", {})
        
        # extracted_chips 생성
        chips = []
        if "top_regions" in filters:
            chips.extend(filters["top_regions"])
        if "gender" in filters:
            chips.append(filters["gender"])
        if "age_range" in filters:
            chips.append(f"{filters['age_range'][0]}대")
        if "age_exact" in filters:
            chips.append(f"{filters['age_exact']}세")
        if "limit" in structured:
            chips.append(f"{structured['limit']}명")
        
        return {
            'text': query_text,
            'filters': filters,
            'extracted_chips': chips,
            'warnings': [],
            'structured': structured,
            'sql': best.get("sql"),
            'coverage_score': best.get("score", 0.0)
        }

