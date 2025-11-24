import apiClient from '../lib/api/client';

/**
 * 내보내기 이력 정보
 */
export interface ExportHistory {
  id: number;
  file_name: string;
  file_type: 'csv' | 'excel' | 'pdf';
  export_type: 'target_group' | 'panel_search' | 'report';
  panel_count: number;
  file_size: number;
  file_size_mb?: number;
  file_path: string;
  status: 'success' | 'failed' | 'processing';
  description: string;
  metadata: Record<string, any>;
  created_at: string;
  completed_at?: string;
  created_by?: string;
}

/**
 * 내보내기 통계
 */
export interface ExportStats {
  total: number;
  success: number;
  failed: number;
  processing: number;
}

/**
 * 내보내기 생성 요청
 */
export interface CreateExportRequest {
  export_type: 'target_group' | 'panel_search' | 'report';
  file_type: 'csv' | 'excel' | 'pdf';
  target_group_id?: number;
  filters?: Record<string, any>;
  description?: string;
  metadata?: Record<string, any>;
  created_by?: string;
}

/**
 * 내보내기 이력 조회
 * GET /api/exports
 */
export const getExportHistory = async (params?: {
  period?: string;
  file_type?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ExportHistory[]> => {
  try {
    const response = await apiClient.get('/api/exports', { params });
    return response.data.history || [];
  } catch (error) {
    console.error('내보내기 이력 조회 오류:', error);
    return [];
  }
};

/**
 * 내보내기 통계 조회
 * GET /api/exports/stats
 */
export const getExportStats = async (): Promise<ExportStats> => {
  try {
    const response = await apiClient.get('/api/exports/stats');
    return response.data;
  } catch (error) {
    console.error('내보내기 통계 조회 오류:', error);
    return {
      total: 0,
      success: 0,
      failed: 0,
      processing: 0,
    };
  }
};

/**
 * 새 내보내기 생성
 * POST /api/exports
 */
export const createExport = async (data: CreateExportRequest): Promise<ExportHistory> => {
  try {
    const response = await apiClient.post('/api/exports', data);
    return response.data;
  } catch (error) {
    console.error('내보내기 생성 오류:', error);
    throw error;
  }
};

/**
 * 내보내기 파일 다운로드
 * GET /api/exports/:id/download
 */
export const downloadExport = async (exportId: number): Promise<void> => {
  try {
    const response = await apiClient.get(`/api/exports/${exportId}/download`, {
      responseType: 'blob',
    });
    
    // Blob을 다운로드 링크로 변환
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Content-Disposition 헤더에서 파일명 추출 시도
    const contentDisposition = response.headers['content-disposition'];
    let fileName = `export_${exportId}.csv`;
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/i);
      if (fileNameMatch) {
        fileName = fileNameMatch[1];
      }
    }
    
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('파일 다운로드 오류:', error);
    throw error;
  }
};

/**
 * 내보내기 상세 정보 조회
 * GET /api/exports/:id
 */
export const getExportDetail = async (exportId: number): Promise<ExportHistory> => {
  try {
    const response = await apiClient.get(`/api/exports/${exportId}`);
    return response.data;
  } catch (error) {
    console.error('내보내기 상세 조회 오류:', error);
    throw error;
  }
};

