import React, { useState, useEffect } from "react";
import { Plus, Edit2, X, Sparkles, Users, Calendar, TrendingUp, Loader2, AlertCircle, Download } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import Badge from "../../components/base/Badge";
import { useTargetGroup } from "../../features/target-group/hooks/useTargetGroup";
import { estimatePanelCount, getAIRecommendations, getAvailableTags } from "../../api/target-group";
import { createExport } from "../../api/export";
import type { TargetGroup, CreateTargetGroupRequest, UpdateTargetGroupRequest } from "../../types/target-group";
import type { RecommendedGroup } from "../../api/target-group";

/**
 * 타겟 그룹 관리 페이지
 * 
 * ⚠️ 중요: 모든 React 훅은 컴포넌트 함수 본문의 최상위에서 호출되어야 합니다.
 * 조건문, 반복문, 중첩 함수 내에서 훅을 호출하면 "Invalid Hook Call" 오류가 발생합니다.
 */
export default function TargetGroupPage() {
  // ✅ 올바른 위치: 컴포넌트 함수 본문의 최상위에서 훅 호출
  // ❌ 잘못된 예시: if문 안, 반복문 안, 중첩 함수 안에서 훅 호출
  const {
    groups: targetGroups,
    stats,
    selectedGroup,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    initialize,
    createGroup,
    updateGroupById,
    deleteGroup,
    setSelectedGroup,
    clearError,
  } = useTargetGroup();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [exportingGroupId, setExportingGroupId] = useState<number | null>(null);

  // 안전한 데이터 접근을 위한 변수 (undefined 방지)
  const safeTargetGroups = targetGroups || [];
  const safeStats = stats || null;

  // 초기 데이터 로드
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        await initialize();
        if (mounted) {
          setInitError(null);
        }
      } catch (err: any) {
        // API 호출 실패해도 페이지는 렌더링되도록 함
        console.error('초기 데이터 로드 실패:', err);
        if (mounted) {
          setInitError(err?.message || '데이터를 불러오는데 실패했습니다.');
        }
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 초기 마운트 시에만 실행

  const handleCreateClick = () => {
    setSelectedGroup(null);
    clearError();
    setIsFormOpen(true);
  };

  const handleEditClick = (group: TargetGroup) => {
    setSelectedGroup(group);
    clearError();
    setIsFormOpen(true);
  };

  const handleExport = async (group: TargetGroup, fileType: 'csv' | 'excel' = 'csv') => {
    try {
      setExportingGroupId(group.id);
      clearError();

      const result = await createExport({
        export_type: 'target_group',
        file_type: fileType,
        target_group_id: group.id,
        description: `${group.name} 내보내기`,
        metadata: {
          group_name: group.name,
          group_summary: group.summary,
          filters: group.filters,
        },
      });

      alert(`내보내기가 시작되었습니다!\n파일명: ${result.file_name}\n내보내기 이력 페이지에서 확인할 수 있습니다.`);
      
      // 내보내기 이력 페이지로 이동 (선택사항)
      // window.location.href = '/export-history';
    } catch (error: any) {
      console.error('내보내기 실패:', error);
      alert(`내보내기 실패: ${error?.response?.data?.message || error?.message || '알 수 없는 오류'}`);
    } finally {
      setExportingGroupId(null);
    }
  };

  const handleSave = async (groupData: {
    name: string;
    summary: string;
    tags: string[];
    size: number;
    ageRange: string;
    gender: string;
    region: string;
  }) => {
    try {
      setIsSubmitting(true);
      clearError();

      const requestData: CreateTargetGroupRequest | UpdateTargetGroupRequest = {
        name: groupData.name,
        summary: groupData.summary,
        tags: groupData.tags,
        size: groupData.size, // 패널 수 포함
        filters: {
          ageRange: groupData.ageRange,
          gender: groupData.gender,
          region: groupData.region,
        },
      };

      if (selectedGroup) {
        // 수정
        await updateGroupById(selectedGroup.id, requestData);
      } else {
        // 생성
        await createGroup(requestData as CreateTargetGroupRequest);
      }

      setIsFormOpen(false);
      // 목록 새로고침
      await initialize();
    } catch (err) {
      // 에러는 스토어에서 관리되므로 여기서는 처리하지 않음
      console.error('타겟 그룹 저장 실패:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("이 타겟 그룹을 삭제하시겠습니까?")) {
      try {
        clearError();
        await deleteGroup(id);
        // 목록 새로고침
        await initialize();
      } catch (err) {
        console.error('타겟 그룹 삭제 실패:', err);
      }
    }
  };

  // 통계 데이터 계산 (백엔드에서 받은 stats 우선, 없으면 클라이언트에서 계산)
  const totalGroups = safeStats?.totalGroups ?? safeTargetGroups.length;
  const largestGroup = safeStats?.largestGroup ?? (safeTargetGroups.length > 0
    ? safeTargetGroups.reduce((max, g) => (g.size > max.size ? g : max), safeTargetGroups[0])
    : null);
  const latestDate = safeStats?.latestCreatedAt ?? (safeTargetGroups.length > 0
    ? safeTargetGroups.reduce((latest, g) => (g.createdAt > latest ? g.createdAt : latest), safeTargetGroups[0].createdAt)
    : "-");

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50/30 px-4 md:px-8 py-6 md:py-8">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-violet-200/20 blur-[120px] mix-blend-multiply animate-blob" />
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-200/20 blur-[120px] mix-blend-multiply animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[700px] h-[700px] rounded-full bg-blue-200/20 blur-[120px] mix-blend-multiply animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* 초기화 에러 메시지 */}
        {initError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-fade-in">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{initError}</p>
              <p className="text-xs text-red-600 mt-1">페이지는 계속 사용할 수 있지만 일부 기능이 제한될 수 있습니다.</p>
            </div>
            <button
              onClick={() => setInitError(null)}
              className="p-1 rounded-lg hover:bg-red-100 transition-colors"
            >
              <X size={16} className="text-red-600" />
            </button>
          </div>
        )}
        
        {/* API 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-fade-in">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="p-1 rounded-lg hover:bg-red-100 transition-colors"
            >
              <X size={16} className="text-red-600" />
            </button>
          </div>
        )}
        {/* 페이지 헤더 */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              타겟 그룹
            </h1>
            <p className="text-sm md:text-base text-slate-600">
              자주 사용하는 조건을 타겟 그룹으로 저장하고, 캠페인·분석에 재사용하세요.
            </p>
          </div>
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#6b7dff] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(105,120,255,0.45)] hover:shadow-[0_15px_35px_rgba(105,120,255,0.6)] hover:scale-[1.02] transition-all duration-200"
          >
            <Plus size={18} />
            <span>새 타겟 그룹 만들기</span>
          </button>
        </div>

        {/* 요약 카드 영역 */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <BentoCard delay={0.1} className="animate-fade-in">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100">
                    <Users size={18} className="text-violet-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">등록된 타겟 그룹</span>
                </div>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={20} className="animate-spin text-slate-400" />
                    <span className="text-sm text-slate-400">로딩 중...</span>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <span className="text-3xl md:text-4xl font-bold text-slate-900">
                      {totalGroups}
                    </span>
                    <span className="text-sm text-slate-400 mb-1">개</span>
                  </div>
                )}
              </div>
            </div>
          </BentoCard>

          <BentoCard delay={0.2} className="animate-fade-in">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100">
                    <TrendingUp size={18} className="text-emerald-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">가장 큰 타겟 그룹</span>
                </div>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-slate-400" />
                    <span className="text-xs text-slate-400">로딩 중...</span>
                  </div>
                ) : largestGroup ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {largestGroup.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {largestGroup.size.toLocaleString()}명
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">-</p>
                )}
              </div>
            </div>
          </BentoCard>

          <BentoCard delay={0.3} className="animate-fade-in">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100">
                    <Calendar size={18} className="text-amber-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">최근 생성일</span>
                </div>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-slate-400" />
                    <span className="text-xs text-slate-400">로딩 중...</span>
                  </div>
                ) : (
                  <div className="text-sm font-semibold text-slate-900">
                    {latestDate}
                  </div>
                )}
              </div>
            </div>
          </BentoCard>
        </div>

        {/* 타겟 그룹 리스트 카드 */}
        <BentoCard delay={0.4} className="animate-fade-in overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 pb-4 border-b border-slate-200/50">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-slate-900">타겟 그룹 리스트</h2>
              <p className="text-xs text-slate-500">
                저장된 타겟 그룹을 선택해 상세 조건을 확인하거나 수정할 수 있습니다.
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 mt-4 md:mt-0 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium text-emerald-700">실시간 필터 미리보기 지원 예정</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-200/50">
                <tr>
                  <th className="px-6 py-4 text-xs uppercase font-semibold text-slate-400 tracking-wider">그룹명</th>
                  <th className="px-6 py-4 text-xs uppercase font-semibold text-slate-400 tracking-wider">조건 요약</th>
                  <th className="px-6 py-4 text-xs uppercase font-semibold text-slate-400 tracking-wider">패널 수</th>
                  <th className="px-6 py-4 text-xs uppercase font-semibold text-slate-400 tracking-wider">생성일</th>
                  <th className="px-6 py-4 text-xs uppercase font-semibold text-slate-400 tracking-wider">태그</th>
                  <th className="px-6 py-4 text-xs uppercase font-semibold text-slate-400 tracking-wider text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 size={32} className="animate-spin text-slate-400" />
                        <p className="text-sm text-slate-400">타겟 그룹을 불러오는 중...</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {safeTargetGroups.map((group, index) => (
                      <tr
                        key={group.id}
                        className="transition-colors cursor-pointer group hover:bg-violet-50/50 animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleEditClick(group)}
                            className="text-sm font-semibold text-slate-900 hover:text-[#7c5cff] transition-colors text-left"
                          >
                            {group.name}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {group.summary}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-700 font-tabular-nums">
                            {group.size.toLocaleString()}명
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {group.createdAt}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {group.tags.map(tag => (
                              <Badge key={tag} variant="info" className="text-[10px] px-2 py-0.5">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleExport(group, 'csv')}
                              disabled={exportingGroupId === group.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="CSV 내보내기"
                            >
                              {exportingGroupId === group.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Download size={14} />
                              )}
                            </button>
                            <button
                              onClick={() => handleEditClick(group)}
                              disabled={isUpdating || isDeleting}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#7c5cff] hover:bg-violet-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="수정"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(group.id)}
                              disabled={isDeleting}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="삭제"
                            >
                              {isDeleting ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <X size={14} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {safeTargetGroups.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="p-4 rounded-full bg-slate-100">
                              <Users size={24} className="text-slate-400" />
                            </div>
                            <p className="text-sm text-slate-400">
                              아직 등록된 타겟 그룹이 없습니다.
                            </p>
                            <p className="text-xs text-slate-400">
                              우측 상단의{" "}
                              <span className="font-semibold text-[#7c5cff]">새 타겟 그룹 만들기</span>
                              {" "}버튼을 눌러 첫 그룹을 생성해보세요.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </BentoCard>
      </div>

      {/* 슬라이드 오버: 타겟 그룹 생성/수정 */}
      <TargetGroupSlideOver
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          clearError();
        }}
        onSave={handleSave}
        initialGroup={selectedGroup}
        isSubmitting={isSubmitting || isCreating || isUpdating}
      />
    </div>
  );
};

type SlideOverProps = {
  open: boolean;
  onClose: () => void;
  onSave: (group: {
    name: string;
    summary: string;
    tags: string[];
    size: number;
    ageRange: string;
    gender: string;
    region: string;
  }) => void;
  initialGroup: TargetGroup | null;
  isSubmitting?: boolean;
};

const TargetGroupSlideOver: React.FC<SlideOverProps> = ({
  open,
  onClose,
  onSave,
  initialGroup,
  isSubmitting = false,
}) => {
  const isEdit = Boolean(initialGroup);

  const [name, setName] = useState(initialGroup?.name ?? "");
  const [ageRange, setAgeRange] = useState(initialGroup?.filters?.ageRange ?? "20–29세");
  const [gender, setGender] = useState(initialGroup?.filters?.gender ?? "전체");
  const [region, setRegion] = useState(initialGroup?.filters?.region ?? "전국");
  const [tags, setTags] = useState<string[]>(initialGroup?.tags ?? []);
  const [expectedSize, setExpectedSize] = useState(initialGroup?.size ?? 0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isAIRecommending, setIsAIRecommending] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);  // DB에서 가져온 태그 목록
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  // 사용 가능한 태그 목록 로드
  useEffect(() => {
    if (open && availableTags.length === 0) {
      const loadAvailableTags = async () => {
        try {
          setIsLoadingTags(true);
          const response = await getAvailableTags();
          if (response.tags && response.tags.length > 0) {
            setAvailableTags(response.tags);
            console.log('[DEBUG] 사용 가능한 태그 로드:', response.tags);
          } else {
            // 태그가 없으면 기본 태그 목록 사용 (fallback)
            console.warn('[WARN] DB에서 태그를 가져올 수 없어 기본 태그 목록을 사용합니다.');
            setAvailableTags(["헬스", "여행", "OTT", "게임", "커피", "이커머스", "금융", "구독", "SNS", "배달", "편의점"]);
          }
        } catch (err) {
          console.error('태그 목록 로드 실패:', err);
          // 에러 발생 시 기본 태그 목록 사용 (fallback)
          setAvailableTags(["헬스", "여행", "OTT", "게임", "커피", "이커머스", "금융", "구독", "SNS", "배달", "편의점"]);
        } finally {
          setIsLoadingTags(false);
        }
      };
      loadAvailableTags();
    }
  }, [open, availableTags.length]);

  // initialGroup이 바뀔 때 상태 동기화
  useEffect(() => {
    if (open) {
      setName(initialGroup?.name ?? "");
      setTags(initialGroup?.tags ?? []);
      setExpectedSize(initialGroup?.size ?? 0);
      setAgeRange(initialGroup?.filters?.ageRange ?? "20–29세");
      setGender(initialGroup?.filters?.gender ?? "전체");
      setRegion(initialGroup?.filters?.region ?? "전국");
      
      // 필터가 있으면 자동으로 패널 수 계산
      if (initialGroup?.filters) {
        calculatePanelCount();
      }
    }
  }, [initialGroup, open]);

  // 필터 변경 시 자동으로 패널 수 계산 (태그 제외)
  useEffect(() => {
    if (open && (ageRange !== "전체" || gender !== "전체" || region !== "전국")) {
      // 디바운스: 500ms 후에 계산
      const timer = setTimeout(() => {
        calculatePanelCount();
      }, 500);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageRange, gender, region, open]);  // tags 의존성 제거 - 태그 변경 시 재계산 안 함

  // 예상 패널 수 계산 함수 (태그 제외 - 연령/성별/지역만)
  const calculatePanelCount = async () => {
    // 필터가 모두 "전체"이면 계산하지 않음
    if (ageRange === "전체" && gender === "전체" && region === "전국") {
      setExpectedSize(0);
      return;
    }

    try {
      setIsCalculating(true);
      
      const response = await estimatePanelCount(
        {
          ageRange: ageRange !== "전체" ? ageRange : undefined,
          gender: gender !== "전체" ? gender : undefined,
          region: region !== "전국" ? region : undefined,
        }
        // 태그는 제외 - 태그 선택 시 재계산하지 않음
      );
      
      setExpectedSize(response.count);
    } catch (err: any) {
      console.error('예상 패널 수 계산 실패:', err);
      // 에러 발생 시 0으로 설정
      setExpectedSize(0);
    } finally {
      setIsCalculating(false);
    }
  };

  // AI 추천 함수
  const handleAIRecommend = async () => {
    try {
      setIsAIRecommending(true);
      const response = await getAIRecommendations();
      
      if (response.recommendedGroups && response.recommendedGroups.length > 0) {
        // 첫 번째 추천 그룹을 폼에 적용
        const recommended = response.recommendedGroups[0];
        setName(recommended.name);
        setAgeRange(recommended.filters.ageRange);
        setGender(recommended.filters.gender);
        setRegion(recommended.filters.region);
        setTags(recommended.tags);
        
        // 추천 그룹의 필터로 패널 수 계산 (태그 제외)
        const countResponse = await estimatePanelCount({
          ageRange: recommended.filters.ageRange,
          gender: recommended.filters.gender,
          region: recommended.filters.region,
        });
        setExpectedSize(countResponse.count);
      }
    } catch (err: any) {
      console.error('AI 추천 실패:', err);
      alert('AI 추천을 불러오는데 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsAIRecommending(false);
    }
  };

  const handleTagToggle = (tag: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
    // 태그는 선택/해제만 되고 패널 수 재계산은 하지 않음
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    // summary는 백엔드에서 자동 생성되므로 여기서는 빈 문자열로 전달
    // 백엔드에서 태그를 포함한 summary를 생성함
    onSave({
      name,
      summary: '',  // 백엔드에서 자동 생성
      size: expectedSize,
      tags,
      ageRange,
      gender,
      region,
    });
  };

  // interestCandidates는 이제 availableTags로 대체됨 (DB에서 동적으로 로드)

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* 뒷배경 */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 슬라이드 패널 */}
      <div className={`relative z-50 h-full w-full max-w-md bg-white/95 backdrop-blur-xl shadow-[0_0_60px_rgba(15,23,42,0.4)] border-l border-white/50 transform transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/50 bg-gradient-to-r from-[#7c5cff] to-[#6b7dff]">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white mb-1">
              {isEdit ? "타겟 그룹 수정" : "새 타겟 그룹 만들기"}
            </h2>
            <p className="text-xs text-white/90">
              조건을 설정하면 예상 패널 수를 확인할 수 있습니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 폼 내용 */}
        <form onSubmit={handleSubmit} className="h-[calc(100%-80px)] overflow-y-auto px-6 py-6 space-y-6">
          {/* 그룹명 */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">그룹명</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#7c5cff]/50 focus:border-[#7c5cff] transition-all"
              placeholder="예) 서울 20대 여성 OTT 이용자"
              required
            />
          </div>

          {/* 기본 필터 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">연령대</label>
              <select
                value={ageRange}
                onChange={e => setAgeRange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#7c5cff]/50 focus:border-[#7c5cff] transition-all"
              >
                <option>전체</option>
                <option>10–19세</option>
                <option>20–29세</option>
                <option>30–39세</option>
                <option>40–49세</option>
                <option>50–59세</option>
                <option>60세 이상</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">성별</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#7c5cff]/50 focus:border-[#7c5cff] transition-all"
              >
                <option>전체</option>
                <option>남성</option>
                <option>여성</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">지역</label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#7c5cff]/50 focus:border-[#7c5cff] transition-all"
              >
                <option>전국</option>
                <option>서울</option>
                <option>경기</option>
                <option>인천</option>
                <option>부산</option>
                <option>대구</option>
                <option>대전</option>
                <option>광주</option>
                <option>울산</option>
              </select>
            </div>
          </div>

          {/* 관심사 태그 */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">관심사 태그</label>
            <div className="flex flex-wrap gap-2">
              {isLoadingTags ? (
                <div className="text-sm text-slate-400">태그 목록 로딩 중...</div>
              ) : availableTags.length === 0 ? (
                <div className="text-sm text-slate-400">사용 가능한 태그가 없습니다.</div>
              ) : (
                availableTags.map(tag => {
                const active = tags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={(e) => handleTagToggle(tag, e)}
                    className={`rounded-full px-4 py-2 text-xs font-medium border transition-all ${
                      active
                        ? "bg-gradient-to-r from-[#7c5cff] to-[#6b7dff] text-white border-transparent shadow-md"
                        : "bg-white border-slate-200 text-slate-600 hover:border-[#7c5cff] hover:text-[#7c5cff]"
                    }`}
                  >
                    #{tag}
                  </button>
                );
              }))}
            </div>
          </div>

          {/* 예상 패널 수 */}
          <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/50">
                  <Users size={16} className="text-violet-600" />
                </div>
                <span className="text-xs font-semibold text-slate-600">예상 패널 수</span>
              </div>
              <button
                type="button"
                onClick={calculatePanelCount}
                disabled={isCalculating}
                className="px-3 py-1 rounded-lg bg-white/80 text-xs font-medium text-violet-600 hover:bg-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isCalculating ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>계산 중...</span>
                  </>
                ) : (
                  <span>재계산</span>
                )}
              </button>
            </div>
            <div className="flex items-end gap-2">
              {isCalculating ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={20} className="animate-spin text-violet-600" />
                  <span className="text-sm text-slate-400">계산 중...</span>
                </div>
              ) : (
                <>
                  <span className="text-3xl font-bold text-slate-900 font-tabular-nums">
                    {expectedSize.toLocaleString()}
                  </span>
                  <span className="text-sm text-slate-500 mb-1">명</span>
                </>
              )}
            </div>
            {expectedSize === 0 && !isCalculating && (
              <p className="text-[10px] text-slate-400 mt-2">
                필터 조건을 설정하면 예상 패널 수를 확인할 수 있습니다.
              </p>
            )}
          </div>

          {/* AI 추천 */}
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white/50 flex-shrink-0">
                <Sparkles size={20} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-700 mb-3 leading-relaxed">
                  아직 조건을 어떻게 설정해야 할지 고민된다면, AI가 최근 캠페인·다운로드 이력을 참고해 추천 타겟 그룹을 제안해줄 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={handleAIRecommend}
                  disabled={isAIRecommending}
                  className="rounded-lg border border-amber-200 bg-white/80 px-4 py-2 text-xs font-medium text-amber-700 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isAIRecommending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>AI 추천 생성 중...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>AI로 추천 조건 생성</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 버튼 영역 */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200/50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#6b7dff] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(105,120,255,0.5)] hover:shadow-[0_15px_35px_rgba(105,120,255,0.6)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? "저장하기" : "생성하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


