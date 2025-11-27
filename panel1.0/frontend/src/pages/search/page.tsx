import { MagicSearchBar } from '../../features/panel/components/MagicSearchBar';
import { ResultDashboard } from '../../features/panel/components/ResultDashboard';
import { PanelDetailSlideOver } from '../../features/panel/components/PanelDetailSlideOver';
import { usePanelSearch } from '../../features/panel/hooks/usePanelSearch';
import type { PanelItem } from '../../features/panel/components/PanelListCard';

// 인터랙티브 필터 칩
const FilterChip = ({ 
  label, 
  value, 
  onRemove 
}: { 
  label: string; 
  value: string; 
  onRemove: () => void;
}) => {
  const icons: Record<string, string> = {
    '지역': '📍',
    '연령': '🎂',
    '성별': '🚹',
  };

  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-sm text-slate-600 shadow-sm cursor-pointer hover:bg-slate-50 hover:border-red-200 hover:text-red-500 transition-all duration-200 group animate-fade-in">
      <span className="text-base">{icons[label] || '🏷️'}</span>
      <span className="font-medium">{label}: {value}</span>
      <button
        onClick={onRemove}
        className="ml-1 text-slate-300 group-hover:text-red-400 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </span>
  );
};

const QUICK_SUGGESTIONS = [
  { icon: '📍', label: '서울/경기', query: '서울 경기 거주 패널' },
  { icon: '💼', label: '3040 직장인', query: '30대 40대 직장인' },
  { icon: '💪', label: '헬스/운동', query: '운동 헬스장 이용 패널' },
  { icon: '📱', label: '얼리어답터', query: '최신 스마트폰 사용 패널' },
];

// Dashboard Skeleton 컴포넌트 (로딩 중 레이아웃 유지)
const DashboardSkeleton = () => (
  <div className="relative z-10 w-full max-w-6xl mt-8 pb-20 animate-fade-in">
    {/* AI Insight Report Skeleton */}
    <section className="w-full rounded-3xl bg-white/80 backdrop-blur-xl shadow-[0_22px_55px_rgba(25,31,86,0.12)] overflow-hidden border border-white/70 mb-8">
      {/* 헤더 스켈레톤 */}
      <div className="w-full bg-gradient-to-r from-gray-200 to-gray-300 px-6 py-4 animate-pulse">
        <div className="h-5 bg-gray-300 rounded w-32" />
      </div>

      {/* 콘텐츠 영역 스켈레톤 */}
      <div className="p-6 md:p-8 flex flex-col gap-6">
        {/* KPI 카드 스켈레톤 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>

        {/* 차트 영역 스켈레톤 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-6 h-64 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-32 mb-4" />
              <div className="h-full bg-gray-200 rounded" />
            </div>
          ))}
        </div>

        {/* 페르소나 & 리스트 스켈레톤 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-100 rounded-2xl p-6 h-64 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-24 mb-4" />
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
          <div className="bg-gray-100 rounded-2xl p-6 h-64 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-24 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* 테이블 스켈레톤 */}
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/50 shadow-sm overflow-hidden mt-8">
      <div className="p-4 border-b border-slate-200/50 bg-slate-50/50">
        <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
      </div>
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
  </div>
);

export default function SearchPage() {
  const {
    query,
    setQuery,
    isSearching,
    isAnalyzing,
    error,
    hasSearched,
    searchResult,
    activeFilters,
    suggestions,
    widgets,
    highlightFilter,
    selectedPanel,
    setSelectedPanel,
    selectedPanelData,
    setSelectedPanelData,
    allResults,
    tableData,
    tableColumns,
    handleSearch,
    handleDownloadExcel,
    handleRemoveFilter,
  } = usePanelSearch();

  // 메인 렌더링: 검색창과 배경은 항상 표시, 결과 영역만 조건부 렌더링
  return (
    <div className="min-h-screen w-full relative flex flex-col items-center px-4 overflow-hidden">
      {/* Animated Background Blobs */}
      {!hasSearched && (
        <>
          <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-violet-200/20 blur-[120px] mix-blend-multiply animate-blob pointer-events-none" />
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-200/20 blur-[120px] mix-blend-multiply animate-blob animation-delay-2000 pointer-events-none" />
          <div className="absolute bottom-[-20%] left-[20%] w-[700px] h-[700px] rounded-full bg-blue-200/20 blur-[120px] mix-blend-multiply animate-blob animation-delay-4000 pointer-events-none" />
        </>
      )}
      
      {/* Magic Search Bar */}
      <div className="relative z-10 w-full max-w-3xl">
        <MagicSearchBar
          query={query}
          setQuery={setQuery}
          onSearch={() => handleSearch()}
          isLoading={isSearching}
          hasSearched={hasSearched}
          suggestions={suggestions}
          onSuggestionClick={(suggestion) => handleSearch(suggestion)}
        />

        {/* Quick Suggestion Chips - 검색 전일 때만 표시 */}
        {!hasSearched && !isSearching && (
          <div className="mt-6 flex flex-wrap gap-3 justify-center animate-fade-in">
            {QUICK_SUGGESTIONS.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(suggestion.query);
                  handleSearch(suggestion.query);
                }}
                className="group flex items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur-md border border-slate-200/50 rounded-full text-sm font-medium text-slate-700 hover:bg-white/80 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-lg transition-all duration-200 shadow-sm"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <span className="text-lg">{suggestion.icon}</span>
                <span>{suggestion.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Smart Filters - 검색 중이 아닐 때만 표시 */}
      {!isSearching && activeFilters.length > 0 && (
        <div className="relative z-10 flex gap-2 mt-4 justify-center flex-wrap animate-fade-in">
          {activeFilters.map((filter, idx) => (
            <FilterChip
              key={idx}
              label={filter.label}
              value={filter.value}
              onRemove={() => handleRemoveFilter(idx)}
            />
          ))}
        </div>
      )}

      {/* Results Area - 조건부 렌더링 (검색창은 항상 유지) */}
      {(() => {
        console.log('[🎨 RENDER] 결과 영역 렌더링 조건 체크:', {
          isSearching,
          hasSearched,
          allResultsLength: allResults.length,
          hasSearchResult: !!searchResult,
          isAnalyzing,
          timestamp: new Date().toISOString()
        });
        
        if (isSearching) {
          console.log('[🎨 RENDER] ✅ 스켈레톤 UI 렌더링 (검색창 유지)');
          return <DashboardSkeleton />;
        }
        
        // count > 0이면 결과가 있는 것으로 판단 (results 배열이 비어있어도)
        const hasResults = (searchResult?.unified?.count ?? 0) > 0 || allResults.length > 0;
        if (hasSearched && hasResults && searchResult) {
          console.log('[🎨 RENDER] ✅ 결과 대시보드 렌더링', {
            allResultsLength: allResults.length,
            count: searchResult?.unified?.count,
            hasResults
          });
          return (
            <ResultDashboard
              searchResult={searchResult}
              allResults={allResults}
              isAnalyzing={isAnalyzing}
              tableData={tableData}
              tableColumns={tableColumns}
              widgets={widgets}
              highlightFilter={highlightFilter}
              onDownloadExcel={handleDownloadExcel}
              hasSearched={hasSearched}
              query={query}
              activeFilters={activeFilters}
              onPanelClick={(panel: PanelItem) => {
                setSelectedPanel(panel.id);
                setSelectedPanelData({
                  id: panel.id,
                  gender: panel.gender,
                  age: panel.age,
                  region: panel.region,
                  matchScore: panel.matchScore,
                  content: panel.content,
                  semanticKeywords: panel.semanticKeywords
                });
              }}
            />
          );
        }
        
        if (hasSearched && error) {
          console.log('[🎨 RENDER] ⚠️ 에러 상태 (결과 없음)');
          return <div className="relative z-10 w-full max-w-6xl mt-8" />; // 빈 div로 레이아웃 유지
        }
        
        console.log('[🎨 RENDER] ⏸️ 아무것도 렌더링 안 함 (초기 상태)');
        return null;
      })()}

      {/* Error Message */}
      {error && (
        <div className="relative z-10 mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-800 animate-fade-in">
          {error}
        </div>
      )}

      {/* Panel Detail Slide Over */}
      <PanelDetailSlideOver
        panelId={selectedPanel}
        panelData={selectedPanelData}
        query={query}
        highlightFields={searchResult?.unified?.parsed_query?.highlight_fields || null}
        onClose={() => {
          setSelectedPanel(null);
          setSelectedPanelData(null);
        }}
      />
    </div>
  );
}
