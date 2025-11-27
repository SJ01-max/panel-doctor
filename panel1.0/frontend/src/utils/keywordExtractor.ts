export interface TrendingKeyword {
  text: string;
  value: number;
}

// 불용어(Stopwords) 목록
const STOP_WORDS = new Set<string>([
  // 동사 / 형용사
  '있다',
  '없다',
  '같다',
  '아니다',
  '그렇다',
  '모름',
  '이렇다',
  '있는',
  '하는',

  // 일반 명사
  '경우',
  '정도',
  '생각',
  '때문',
  '사람',
  '자신',
  '본인',
  '귀하',
  '다음',
  '가지',

  // 설문/조사 관련 용어
  '브랜드',
  '제품',
  '서비스',
  '이용',
  '사용',
  '구매',
  '질문',
  '응답',
  '선택',
  '기타',
  '평소',
  '최근',
  '가장',
  '주로',
  '모델명',
  '시리즈',
  '개인소득',
  '월평균',
  '직업',
  '직무',

  // 조사 / 연결어
  '대해',
  '위해',
  '통해',
  '관련',
]);

// 패널 하나에서 텍스트 필드를 최대한 뽑아서 하나의 문자열로 결합
const extractTextFromPanel = (panel: any): string => {
  if (!panel || typeof panel !== 'object') return '';

  const pieces: string[] = [];

  // 대표 필드들 우선 사용
  if (typeof panel.content === 'string') pieces.push(panel.content);
  if (typeof panel.json_doc === 'string') pieces.push(panel.json_doc);

  // json_doc이 객체인 경우, 값들을 펼쳐서 사용
  if (panel.json_doc && typeof panel.json_doc === 'object') {
    try {
      const flattenValues = (obj: any): string[] => {
        if (!obj) return [];
        if (typeof obj === 'string') return [obj];
        if (typeof obj === 'number' || typeof obj === 'boolean') return [String(obj)];
        if (Array.isArray(obj)) return obj.flatMap(flattenValues);
        if (typeof obj === 'object') return Object.values(obj).flatMap(flattenValues);
        return [];
      };
      pieces.push(...flattenValues(panel.json_doc));
    } catch {
      // flatten 실패 시 무시
    }
  }

  // 기타 텍스트성 필드들 (예: lifestyle, tech, habit 등)이 있으면 포함
  const extraKeys = [
    'lifestyle',
    'tech',
    'habit',
    'values',
    'life',
    'beauty',
  ];
  for (const key of extraKeys) {
    const val = panel[key];
    if (typeof val === 'string') pieces.push(val);
  }

  return pieces.join(' ');
};

/**
 * 검색 결과 패널 배열에서 자주 등장하는 키워드를 추출
 * @param results 패널 결과 배열 (최대 1000개 정도를 기대)
 * @param topK 상위 몇 개의 키워드를 반환할지 (기본값 20)
 */
export const extractTrendingKeywords = (
  results: any[],
  topK: number = 20,
): TrendingKeyword[] => {
  if (!Array.isArray(results) || results.length === 0) return [];

  const freq = new Map<string, number>();
  const limit = Math.min(results.length, 1000);

  for (let i = 0; i < limit; i += 1) {
    const panel = results[i];
    const text = extractTextFromPanel(panel);
    if (!text) continue;

    // 2글자 이상인 한글/영문/숫자 토큰 추출
    const tokens = text.match(/[가-힣a-zA-Z0-9]{2,}/g);
    if (!tokens) continue;

    tokens.forEach((raw) => {
      let token = raw.trim();
      if (!token) return;

      // 모두 숫자인 토큰은 제외 (연도, 금액 등)
      if (/^\d+$/.test(token)) return;

      // 소문자 변환 (영문)
      token = token.toLowerCase();

      // 불용어 필터링
      if (STOP_WORDS.has(token)) return;

      const prev = freq.get(token) || 0;
      freq.set(token, prev + 1);
    });
  }

  const sorted = Array.from(freq.entries())
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value);

  return sorted.slice(0, topK);
};


