import apiClient from '../lib/api/client';
import type { 
  PanelSearchResult, 
  DashboardData 
} from '../types/panel';

// ----------------------------------------------------------------
// 패널 관련 API 함수들
// ----------------------------------------------------------------

/**
 * 자연어 질의로 패널을 검색하는 API
 * 백엔드 API (POST /api/panel/search)를 호출합니다.
 * @param queryText 사용자가 입력한 자연어
 * @param previousPanelIds 이전 추출 결과의 패널 ID 목록 (후속 질의 시 사용)
 * @returns 검색 결과
 */
export const searchPanels = async (queryText: string, previousPanelIds?: string[]): Promise<PanelSearchResult> => {
  try {
    const body: { query: string; previous_panel_ids?: string[] } = { query: queryText };
    if (previousPanelIds && previousPanelIds.length > 0) {
      body.previous_panel_ids = previousPanelIds;
    }
    const response = await apiClient.post('/api/panel/search', body);
    return response.data;
  } catch (error) {
    console.error("패널 검색 API 오류:", error);
    throw error;
  }
};

/**
 * 패널 대시보드 데이터(KPI, 최근 질의)를 가져오는 API
 * 백엔드 API (GET /api/panel/dashboard)를 호출합니다.
 */
export const getDashboardData = async (): Promise<DashboardData> => {
  try {
    const response = await apiClient.get('/api/panel/dashboard');
    return response.data;
  } catch (error) {
    console.error("대시보드 API 오류:", error);
    throw error;
  }
};

/**
 * 데이터 품질 진단 데이터를 가져오는 API
 * 백엔드 API (GET /api/panel/health)를 호출합니다.
 */
export interface HealthData {
  score: number;
  total: number;
  complete: number;
  profileCompleteness: number;
  contactValidity: number;
  marketingConsent: number;
}

export const getHealthData = async (): Promise<HealthData> => {
  try {
    const response = await apiClient.get('/api/panel/health');
    return response.data;
  } catch (error) {
    console.error("데이터 품질 진단 API 오류:", error);
    throw error;
  }
};
