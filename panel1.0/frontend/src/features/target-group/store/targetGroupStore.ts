import { create } from 'zustand';
import type { TargetGroup, TargetGroupStats } from '../../../types/target-group';

interface TargetGroupState {
  // 데이터
  groups: TargetGroup[];
  stats: TargetGroupStats | null;
  selectedGroup: TargetGroup | null;
  
  // 로딩 상태
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  
  // 에러 상태
  error: string | null;
  
  // 액션
  setGroups: (groups: TargetGroup[]) => void;
  addGroup: (group: TargetGroup) => void;
  updateGroup: (id: number, group: Partial<TargetGroup>) => void;
  removeGroup: (id: number) => void;
  setSelectedGroup: (group: TargetGroup | null) => void;
  setStats: (stats: TargetGroupStats) => void;
  setLoading: (loading: boolean) => void;
  setCreating: (creating: boolean) => void;
  setUpdating: (updating: boolean) => void;
  setDeleting: (deleting: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  groups: [],
  stats: null,
  selectedGroup: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
};

// Zustand store 생성 - 명시적으로 타입 지정
export const useTargetGroupStore = create<TargetGroupState>((set, get) => ({
  ...initialState,
  
  setGroups: (groups) => set({ groups }),
  
  addGroup: (group) => set((state) => ({
    groups: [...state.groups, group],
  })),
  
  updateGroup: (id, partialGroup) => set((state) => ({
    groups: state.groups.map((g) =>
      g.id === id ? { ...g, ...partialGroup } : g
    ),
    selectedGroup: state.selectedGroup?.id === id
      ? { ...state.selectedGroup, ...partialGroup }
      : state.selectedGroup,
  })),
  
  removeGroup: (id) => set((state) => ({
    groups: state.groups.filter((g) => g.id !== id),
    selectedGroup: state.selectedGroup?.id === id ? null : state.selectedGroup,
  })),
  
  setSelectedGroup: (group) => set({ selectedGroup: group }),
  
  setStats: (stats) => set({ stats }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setCreating: (isCreating) => set({ isCreating }),
  
  setUpdating: (isUpdating) => set({ isUpdating }),
  
  setDeleting: (isDeleting) => set({ isDeleting }),
  
  setError: (error) => set({ error }),
  
  reset: () => set(initialState),
}));
