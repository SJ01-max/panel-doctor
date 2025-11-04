/**
 * 자연어 질의 API 응답 (QueryCanvas.tsx용)
 * "정확도"와 "일치율" 측정을 위한 모든 증거를 포함합니다.
 */
export interface PanelSearchResult {
  /**
   * (정확도 증거 1)
   * LLM이 자연어에서 추출한 핵심 키워드(칩).
   * 예: ["서울", "20대", "남자", "100명(목표)"]
   */
  extractedChips: string[];

  /**
   * (정확도 증거 2)
   * LLM이 자연어를 실제 DB 컬럼에 매핑한 "필터 증거" 배열.
   * "정확도" 점수는 이 필터를 보고 산출할 수 있습니다.
   */
  previewData: {
    /** * LLM이 번역한 (사람이 읽을 수 있는) 컬럼명
     * 예: "거주지", "나이", "성별" 
     */
    columnHuman: string;

    /** * LLM이 매핑한 실제 DB 원본 컬럼명 (정확도 채점용 핵심)
     * 예: "Q12_1", "Q11", "Q10"
     */
    columnRaw: string;

    /** * 적용된 연산자
     * 예: "=", "BETWEEN", "IN"
     */
    operator: string;

    /** * 적용된 값
     * 예: "서울", "1996-2005", "M"
     */
    value: string;
  }[];

  /**
   * (일치율 결과 1)
   * 위 previewData 필터로 psql을 쿼리한 최종 인원 수.
   */
  estimatedCount: number;

  /**
   * (정확도 증거 3)
   * LLM이 질의를 처리하며 발견한 예외/경고 사항.
   * "술"처럼 데이터에 없는 조건을 정확히 찾아냈는지(정확도),
   * "100명"을 목표치로 정확히 해석했는지(정확도)를 증명합니다.
   */
  warnings: string[];

  /**
   * (일치율 결과 2: 핵심)
   * "일치율" 점수 산출을 위해, 조건을 만족하는 모든 패널의 ID (mb_sn) 목록.
   * 백엔드는 이 목록을 반환해야 테스터가 ID를 비교할 수 있습니다.
   * 예: ["w291516899167465", "w462602481665114", "w462602513797087", ...]
   */
  panelIds: string[];
}

// ... KpiData, RecentQuery, DashboardData 타입은 변경 없음 ...

/**
 * 대시보드 KPI 항목 타입 (Dashboard.tsx용)
 */
export interface KpiData {
  title: string;
  value: string;
  change: string;
  icon: string;
  color: string;
}

/**
 * 대시보드 최근 질의 항목 타입 (Dashboard.tsx용)
 */
export interface RecentQuery {
  id: number;
  query: string;
  chips: string[];
  status: 'success' | 'warning';
  time: string;
  executor: string;
  resultCount: number;
}

/**
 * 대시보드 전체 데이터 API 응답 (Dashboard.tsx용)
 */
export interface DashboardData {
  kpiData: KpiData[];
  recentQueries: RecentQuery[];
}

