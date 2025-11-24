import { useCallback } from 'react';
import {
  getTargetGroups,
  getTargetGroup,
  createTargetGroup,
  updateTargetGroup,
  deleteTargetGroup,
  getTargetGroupStats,
} from '../../../api/target-group';
import { useTargetGroupStore } from '../store/targetGroupStore';
import type {
  CreateTargetGroupRequest,
  UpdateTargetGroupRequest,
} from '../../../types/target-group';

/**
 * 타겟 그룹 관련 커스텀 훅
 * 
 * ⚠️ 중요: 이 훅은 반드시 React 컴포넌트 내부에서만 호출되어야 합니다.
 * 컴포넌트 외부나 조건부로 호출하면 "Invalid Hook Call" 오류가 발생합니다.
 */
export const useTargetGroup = () => {
  // Zustand store에서 선택자 함수를 사용하여 필요한 값만 가져오기
  // 이렇게 하면 불필요한 리렌더링을 방지하고 훅 호출이 안정적입니다.
  const groups = useTargetGroupStore((state) => state.groups);
  const stats = useTargetGroupStore((state) => state.stats);
  const selectedGroup = useTargetGroupStore((state) => state.selectedGroup);
  const isLoading = useTargetGroupStore((state) => state.isLoading);
  const isCreating = useTargetGroupStore((state) => state.isCreating);
  const isUpdating = useTargetGroupStore((state) => state.isUpdating);
  const isDeleting = useTargetGroupStore((state) => state.isDeleting);
  const error = useTargetGroupStore((state) => state.error);
  
  // 액션 함수들은 직접 참조 (함수는 변경되지 않으므로)
  const setGroups = useTargetGroupStore((state) => state.setGroups);
  const addGroup = useTargetGroupStore((state) => state.addGroup);
  const updateGroup = useTargetGroupStore((state) => state.updateGroup);
  const removeGroup = useTargetGroupStore((state) => state.removeGroup);
  const setSelectedGroup = useTargetGroupStore((state) => state.setSelectedGroup);
  const setStats = useTargetGroupStore((state) => state.setStats);
  const setLoading = useTargetGroupStore((state) => state.setLoading);
  const setCreating = useTargetGroupStore((state) => state.setCreating);
  const setUpdating = useTargetGroupStore((state) => state.setUpdating);
  const setDeleting = useTargetGroupStore((state) => state.setDeleting);
  const setError = useTargetGroupStore((state) => state.setError);

  /**
   * 타겟 그룹 목록 조회
   */
  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getTargetGroups();
      setGroups(response.groups || []);
    } catch (err: any) {
      // 404나 네트워크 오류는 치명적이지 않음 (백엔드 API가 아직 구현되지 않았을 수 있음)
      if (err?.response?.status === 404) {
        console.warn('타겟 그룹 API가 아직 구현되지 않았습니다. 빈 목록을 표시합니다.');
        setGroups([]);
        return;
      }
      const errorMessage = err?.response?.data?.message || err?.message || '타겟 그룹 목록을 불러오는데 실패했습니다.';
      setError(errorMessage);
      console.error('타겟 그룹 목록 조회 실패:', err);
      // 에러가 발생해도 빈 배열로 설정하여 페이지가 렌더링되도록 함
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [setGroups, setLoading, setError]);

  /**
   * 타겟 그룹 상세 조회
   */
  const fetchGroup = useCallback(async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await getTargetGroup(id);
      setSelectedGroup(response.group);
      return response.group;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || '타겟 그룹을 불러오는데 실패했습니다.';
      setError(errorMessage);
      console.error('타겟 그룹 상세 조회 실패:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setSelectedGroup, setLoading, setError]);

  /**
   * 타겟 그룹 생성
   */
  const createGroup = useCallback(async (data: CreateTargetGroupRequest) => {
    try {
      setCreating(true);
      setError(null);
      const newGroup = await createTargetGroup(data);
      addGroup(newGroup);
      return newGroup;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || '타겟 그룹 생성에 실패했습니다.';
      setError(errorMessage);
      console.error('타겟 그룹 생성 실패:', err);
      throw err;
    } finally {
      setCreating(false);
    }
  }, [addGroup, setCreating, setError]);

  /**
   * 타겟 그룹 수정
   */
  const updateGroupById = useCallback(async (id: number, data: UpdateTargetGroupRequest) => {
    try {
      setUpdating(true);
      setError(null);
      const updatedGroup = await updateTargetGroup(id, data);
      updateGroup(id, updatedGroup);
      return updatedGroup;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || '타겟 그룹 수정에 실패했습니다.';
      setError(errorMessage);
      console.error('타겟 그룹 수정 실패:', err);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [updateGroup, setUpdating, setError]);

  /**
   * 타겟 그룹 삭제
   */
  const deleteGroup = useCallback(async (id: number) => {
    try {
      setDeleting(true);
      setError(null);
      await deleteTargetGroup(id);
      removeGroup(id);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || '타겟 그룹 삭제에 실패했습니다.';
      setError(errorMessage);
      console.error('타겟 그룹 삭제 실패:', err);
      throw err;
    } finally {
      setDeleting(false);
    }
  }, [removeGroup, setDeleting, setError]);

  /**
   * 타겟 그룹 통계 조회
   */
  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const statsData = await getTargetGroupStats();
      setStats(statsData);
      return statsData;
    } catch (err: any) {
      // 404나 네트워크 오류는 치명적이지 않음 (백엔드 API가 아직 구현되지 않았을 수 있음)
      if (err?.response?.status === 404) {
        console.warn('타겟 그룹 통계 API가 아직 구현되지 않았습니다.');
        return null;
      }
      const errorMessage = err?.response?.data?.message || err?.message || '통계 정보를 불러오는데 실패했습니다.';
      // 통계 조회 실패는 치명적이지 않으므로 에러를 표시하지 않음
      console.warn('타겟 그룹 통계 조회 실패:', err);
    }
  }, [setStats, setError]);

  /**
   * 초기 로드: 목록과 통계를 함께 조회
   */
  const initialize = useCallback(async () => {
    await Promise.all([fetchGroups(), fetchStats()]);
  }, [fetchGroups, fetchStats]);

  return {
    // 데이터
    groups,
    stats,
    selectedGroup,
    
    // 로딩 상태
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    
    // 에러
    error,
    
    // 액션
    fetchGroups,
    fetchGroup,
    createGroup,
    updateGroupById,
    deleteGroup,
    fetchStats,
    initialize,
    setSelectedGroup,
    clearError: () => setError(null),
  };
};
