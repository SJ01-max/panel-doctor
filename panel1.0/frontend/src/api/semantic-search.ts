import apiClient from '../lib/api/client';

/**
 * 의미 기반 검색 API 응답 타입
 */
export interface SemanticSearchResponse {
  query: string;
  keywords: string[];
  summary: string;
  stats: {
    avg: number;
    max: number;
    top10_avg: number;
    count: number;
  };
  panels: Array<{
    respondent_id: string;
    age: number;
    gender: 'M' | 'F' | string;
    region: string;
    score: number;
    tags?: string[];
    distance?: number;
    age_text?: string;
    content?: string;
  }>;
}

/**
 * 의미 기반 검색 API
 * @param query 사용자 자연어 질의
 * @returns 의미 기반 검색 결과
 */
export const semanticSearch = async (
  query: string
): Promise<SemanticSearchResponse> => {
  try {
    const response = await apiClient.post('/api/semantic-search', { query });
    return response.data;
  } catch (error) {
    console.error('의미 기반 검색 API 오류:', error);
    throw error;
  }
};








