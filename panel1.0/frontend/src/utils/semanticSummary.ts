/**
 * 의미 기반 검색 결과를 한국어 요약 문장으로 변환하는 헬퍼 함수
 */

export type AgeScorePoint = { age: number; score: number };
export type RegionScorePoint = { region: string; score: number };

export interface SemanticStats {
  avgScore: number;   // 전체 평균 (0~100)
  maxScore: number;   // 최대 점수
  candidateCount: number; // 후보 패널 수
}

/**
 * 통계 데이터를 받아서 한국어 요약 문장을 생성
 * 
 * @param stats 통계 정보
 * @param ageScores 연령별 점수 데이터
 * @param regionScores 지역별 평균 점수 데이터
 * @returns 한국어 요약 문장
 */
export function buildSemanticSummary(
  stats: SemanticStats,
  ageScores: AgeScorePoint[],
  regionScores: RegionScorePoint[]
): string {
  if (!ageScores.length) {
    return `이번 검색의 평균 Match Score는 약 ${Math.round(
      stats.avgScore
    )}%이며, 총 ${stats.candidateCount}명의 후보 패널이 탐색되었습니다.`;
  }

  // 1) 연령대별 평균 점수 계산 (10살 단위: 10대, 20대, 30대...)
  const decadeMap = new Map<number, { sum: number; count: number }>();
  ageScores.forEach(({ age, score }) => {
    const decade = Math.floor(age / 10) * 10; // 23 -> 20, 37 -> 30
    const entry = decadeMap.get(decade) ?? { sum: 0, count: 0 };
    entry.sum += score;
    entry.count += 1;
    decadeMap.set(decade, entry);
  });

  let bestDecade = 0;
  let bestDecadeAvg = 0;

  decadeMap.forEach((v, decade) => {
    const avg = v.sum / v.count;
    if (avg > bestDecadeAvg) {
      bestDecadeAvg = avg;
      bestDecade = decade;
    }
  });

  // 2) 지역 중 상위 1개 (혹은 2개) 추출
  const sortedRegions = [...regionScores].sort((a, b) => b.score - a.score);
  const topRegionNames = sortedRegions.slice(0, 2).map(r => r.region);

  const decadeLabel =
    bestDecade === 0 ? "특정 연령대" : `${bestDecade}–${bestDecade + 9}대`;

  const avg = Math.round(stats.avgScore);
  const max = Math.round(stats.maxScore);

  let regionPart = "";
  if (topRegionNames.length === 1) {
    regionPart = `${topRegionNames[0]} 지역 패널의 유사도가 특히 높게 나타났습니다.`;
  } else if (topRegionNames.length >= 2) {
    regionPart = `${topRegionNames[0]}와(과) ${topRegionNames[1]} 지역 패널의 유사도가 상대적으로 높게 나타났습니다.`;
  }

  const base = `이번 검색은 **${decadeLabel}에서 Match Score가 가장 높게 나타났습니다.**`;
  const scoreInfo = `전체 평균 점수는 약 **${avg}%**, 최고 점수는 **${max}%**입니다.`;
  const regionInfo = regionPart ? `또한 ${regionPart}` : "";

  return `${base} ${scoreInfo} ${regionInfo}`.trim();
}





