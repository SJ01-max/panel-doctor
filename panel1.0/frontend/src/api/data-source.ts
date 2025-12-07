import apiClient from '../lib/api/client';

/**
 * 데이터 소스 통계 정보
 */
export interface DataSourceStats {
  totalFiles: number;
  totalQuestions: number;
  totalPanels: number;
  lastUpdated: string;
}

/**
 * 데이터 소스 테이블 정보
 */
export interface DataSourceTable {
  name: string;
  schema: string;
  rows: number;
  columns: number;
  columnNames: string[];
  status: 'success' | 'error' | 'empty';
  error?: string;
}

/**
 * 스키마 정보
 */
export interface SchemaInfo {
  table: string;
  fields: string[];
}

/**
 * 데이터 소스 통계 조회
 * GET /api/data-sources/stats
 */
export const getDataSourceStats = async (): Promise<DataSourceStats> => {
  try {
    const response = await apiClient.get('/api/data-sources/stats');
    return response.data;
  } catch (error) {
    console.error('데이터 소스 통계 조회 오류:', error);
    // 에러 발생 시 기본값 반환
    return {
      totalFiles: 0,
      totalQuestions: 0,
      totalPanels: 0,
      lastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };
  }
};

/**
 * 데이터 소스 테이블 목록 조회
 * GET /api/data-sources/tables
 */
export const getDataSourceTables = async (): Promise<DataSourceTable[]> => {
  try {
    const response = await apiClient.get('/api/data-sources/tables');
    return response.data.tables || [];
  } catch (error) {
    console.error('테이블 목록 조회 오류:', error);
    return [];
  }
};

/**
 * 스키마 정보 조회
 * GET /api/data-sources/schema
 */
export const getSchemaInfo = async (): Promise<SchemaInfo[]> => {
  try {
    const response = await apiClient.get('/api/data-sources/schema');
    return response.data.schemas || [];
  } catch (error) {
    console.error('스키마 정보 조회 오류:', error);
    return [];
  }
};

/**
 * 에러 로그 조회
 * GET /api/data-sources/errors
 */
export interface ErrorLog {
  file: string;
  error: string;
  timestamp?: string;
}

export const getErrorLogs = async (): Promise<ErrorLog[]> => {
  try {
    const response = await apiClient.get('/api/data-sources/errors');
    return response.data.errors || [];
  } catch (error) {
    console.error('에러 로그 조회 오류:', error);
    return [];
  }
};

/**
 * 적재 이력 조회
 * GET /api/data-sources/history
 */
export interface LoadHistoryItem {
  time: string;
  file: string;
  rows: string;
  status: '성공' | '실패';
}

export const getLoadHistory = async (): Promise<LoadHistoryItem[]> => {
  try {
    const response = await apiClient.get('/api/data-sources/history');
    return response.data.history || [];
  } catch (error) {
    console.error('적재 이력 조회 오류:', error);
    return [];
  }
};

/**
 * 테이블 미리보기 데이터 조회
 * GET /api/data-sources/tables/:schema/:table/preview?limit=100
 */
export interface TablePreview {
  schema: string;
  table: string;
  columns: string[];
  rows: Record<string, any>[];
  totalRows: number;
  previewedRows: number;
}

export const getTablePreview = async (
  schema: string,
  tableName: string,
  limit: number = 100
): Promise<TablePreview> => {
  try {
    const response = await apiClient.get(
      `/api/data-sources/tables/${schema}/${tableName}/preview`,
      { params: { limit } }
    );
    return response.data;
  } catch (error) {
    console.error('테이블 미리보기 조회 오류:', error);
    throw error;
  }
};

