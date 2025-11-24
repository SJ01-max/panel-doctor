import apiClient from '../lib/api/client';
import type {
  TargetGroup,
  CreateTargetGroupRequest,
  UpdateTargetGroupRequest,
  TargetGroupListResponse,
  TargetGroupDetailResponse,
  TargetGroupStats,
} from '../types/target-group';

/**
 * 백엔드 응답을 프론트엔드 타입으로 변환
 */
const mapTargetGroup = (group: any): TargetGroup => {
  return {
    ...group,
    createdAt: group.created_at || group.createdAt || '',
    updatedAt: group.updated_at || group.updatedAt,
  };
};

/**
 * 타겟 그룹 목록 조회
 * GET /api/target-groups
 */
export const getTargetGroups = async (): Promise<TargetGroupListResponse> => {
  try {
    const response = await apiClient.get('/api/target-groups');
    return {
      ...response.data,
      groups: (response.data.groups || []).map(mapTargetGroup),
    };
  } catch (error) {
    console.error('타겟 그룹 목록 조회 오류:', error);
    throw error;
  }
};

/**
 * 타겟 그룹 상세 조회
 * GET /api/target-groups/:id
 */
export const getTargetGroup = async (id: number): Promise<TargetGroupDetailResponse> => {
  try {
    const response = await apiClient.get(`/api/target-groups/${id}`);
    return {
      ...response.data,
      group: mapTargetGroup(response.data.group),
    };
  } catch (error) {
    console.error('타겟 그룹 상세 조회 오류:', error);
    throw error;
  }
};

/**
 * 타겟 그룹 생성
 * POST /api/target-groups
 */
export const createTargetGroup = async (
  data: CreateTargetGroupRequest
): Promise<TargetGroup> => {
  try {
    const response = await apiClient.post('/api/target-groups', data);
    return mapTargetGroup(response.data);
  } catch (error) {
    console.error('타겟 그룹 생성 오류:', error);
    throw error;
  }
};

/**
 * 타겟 그룹 수정
 * PUT /api/target-groups/:id
 */
export const updateTargetGroup = async (
  id: number,
  data: UpdateTargetGroupRequest
): Promise<TargetGroup> => {
  try {
    const response = await apiClient.put(`/api/target-groups/${id}`, data);
    return mapTargetGroup(response.data);
  } catch (error) {
    console.error('타겟 그룹 수정 오류:', error);
    throw error;
  }
};

/**
 * 타겟 그룹 삭제
 * DELETE /api/target-groups/:id
 */
export const deleteTargetGroup = async (id: number): Promise<void> => {
  try {
    await apiClient.delete(`/api/target-groups/${id}`);
  } catch (error) {
    console.error('타겟 그룹 삭제 오류:', error);
    throw error;
  }
};

/**
 * 타겟 그룹 통계 조회
 * GET /api/target-groups/stats
 */
export const getTargetGroupStats = async (): Promise<TargetGroupStats> => {
  try {
    const response = await apiClient.get('/api/target-groups/stats');
    return response.data;
  } catch (error) {
    console.error('타겟 그룹 통계 조회 오류:', error);
    throw error;
  }
};

/**
 * 예상 패널 수 계산
 * POST /api/target-groups/estimate-count
 */
export interface EstimateCountRequest {
  filters: {
    ageRange?: string;
    gender?: string;
    region?: string;
  };
  tags?: string[];  // 태그 배열 추가
}

export interface EstimateCountResponse {
  count: number;
  filters_applied: {
    age_range?: string;
    gender?: string;
    region?: string;
  };
}

export const estimatePanelCount = async (
  filters: EstimateCountRequest['filters'],
  tags?: string[]  // 태그 파라미터 추가
): Promise<EstimateCountResponse> => {
  try {
    const response = await apiClient.post('/api/target-groups/estimate-count', {
      filters,
      tags: tags || [],  // 태그 배열 전달
    });
    return response.data;
  } catch (error) {
    console.error('예상 패널 수 계산 오류:', error);
    throw error;
  }
};

/**
 * AI 기반 타겟 그룹 추천
 * POST /api/target-groups/ai-recommend
 */
export interface AIRecommendRequest {
  context?: string;
}

export interface RecommendedGroup {
  name: string;
  summary: string;
  filters: {
    ageRange: string;
    gender: string;
    region: string;
  };
  tags: string[];
  reason: string;
}

export interface AIRecommendResponse {
  recommendedGroups: RecommendedGroup[];
}

export const getAIRecommendations = async (
  context?: string
): Promise<AIRecommendResponse> => {
  try {
    const response = await apiClient.post('/api/target-groups/ai-recommend', {
      context,
    });
    return response.data;
  } catch (error) {
    console.error('AI 추천 오류:', error);
    throw error;
  }
};

/**
 * 사용 가능한 관심사 태그 목록 조회
 * GET /api/target-groups/available-tags
 */
export interface AvailableTagsResponse {
  tags: string[];
  count: number;
  error?: string;
}

export const getAvailableTags = async (): Promise<AvailableTagsResponse> => {
  try {
    const response = await apiClient.get('/api/target-groups/available-tags');
    return response.data;
  } catch (error) {
    console.error('태그 목록 조회 오류:', error);
    // 에러 발생 시 빈 배열 반환
    return {
      tags: [],
      count: 0,
      error: error instanceof Error ? error.message : '태그 목록을 불러오는데 실패했습니다.'
    };
  }
};

