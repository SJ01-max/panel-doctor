import apiClient from '../lib/api/client';

/**
 * 통합 검색 API 응답 타입
 */
export interface UnifiedSearchResponse {
  results: Array<{
    respondent_id?: string;
    doc_id?: number;
    gender?: string;
    age_text?: string;
    region?: string;
    content?: string;
    distance?: number;
    [key: string]: unknown;
  }>;
  count: number;
  strategy: 'filter_first' | 'semantic_first' | 'hybrid';
  parsed_query: {
    filters: {
      age?: string;
      gender?: string;
      region?: string;
      [key: string]: unknown;
    };
    semantic_keywords: string[];
    intent: string;
    search_mode: string;
    limit?: number;
  };
  selected_strategy: string;
  strategy_info: {
    name: string;
    description: string;
    uses_sql: boolean;
    uses_embedding: boolean;
  };
  has_results: boolean;
  fallback_attempted?: boolean;
  fallback_used?: string | null;
  region_stats?: Array<{ region: string; region_count: number }>; // 지역별 통계 추가
  age_stats?: Array<{ age_group: string; age_count: number }>; // 연령대별 통계 추가
}

/**
 * 통합 검색 API
 * 모든 자연어 질의를 자동으로 처리합니다.
 * 
 * @param query 사용자 자연어 질의
 * @param model 사용할 LLM 모델 (선택사항)
 * @returns 검색 결과
 */
export const unifiedSearch = async (
  query: string,
  model?: string
): Promise<UnifiedSearchResponse> => {
  try {
    const body: { query: string; model?: string } = { query };
    if (model) {
      body.model = model;
    }
    const response = await apiClient.post('/api/search', body);
    return response.data;
  } catch (error) {
    console.error('통합 검색 API 오류:', error);
    throw error;
  }
};

