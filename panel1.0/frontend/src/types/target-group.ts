/**
 * 타겟 그룹 관련 타입 정의
 */

/**
 * 타겟 그룹 기본 정보
 */
export interface TargetGroup {
  id: number;
  name: string;
  summary: string;
  size: number;
  createdAt: string;
  updatedAt?: string;
  tags: string[];
  // 필터 조건 (백엔드에서 저장되는 실제 필터 데이터)
  filters?: {
    ageRange?: string;
    gender?: string;
    region?: string;
    [key: string]: unknown;
  };
  // 메타데이터
  description?: string;
  createdBy?: string;
}

/**
 * 타겟 그룹 생성 요청 데이터
 */
export interface CreateTargetGroupRequest {
  name: string;
  summary: string;
  tags: string[];
  size?: number;
  filters?: {
    ageRange?: string;
    gender?: string;
    region?: string;
    [key: string]: unknown;
  };
  description?: string;
}

/**
 * 타겟 그룹 수정 요청 데이터
 */
export interface UpdateTargetGroupRequest {
  name?: string;
  summary?: string;
  tags?: string[];
  size?: number;
  filters?: {
    ageRange?: string;
    gender?: string;
    region?: string;
    [key: string]: unknown;
  };
  description?: string;
}

/**
 * 타겟 그룹 목록 조회 응답
 */
export interface TargetGroupListResponse {
  groups: TargetGroup[];
  total: number;
  page?: number;
  pageSize?: number;
}

/**
 * 타겟 그룹 상세 조회 응답
 */
export interface TargetGroupDetailResponse {
  group: TargetGroup;
  // 추가 정보 (예: 최근 사용 이력 등)
  usageHistory?: Array<{
    date: string;
    action: string;
    userId?: string;
  }>;
}

/**
 * 타겟 그룹 통계 정보
 */
export interface TargetGroupStats {
  totalGroups: number;
  totalSize: number;
  largestGroup: {
    id: number;
    name: string;
    size: number;
  } | null;
  latestCreatedAt: string | null;
  averageSize: number;
}

