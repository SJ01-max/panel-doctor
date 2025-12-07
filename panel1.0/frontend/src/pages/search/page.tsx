import { MagicSearchBar } from '../../features/panel/components/MagicSearchBar';
import { ResultDashboard } from '../../features/panel/components/ResultDashboard';
import { PanelDetailSlideOver } from '../../features/panel/components/PanelDetailSlideOver';
import { usePanelSearch } from '../../features/panel/hooks/usePanelSearch';
import type { PanelItem } from '../../features/panel/types/PanelItem';

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
  { icon: '😰', label: '스트레스를 받는 사람들', query: '스트레스를 받는 사람들' },
  { icon: '📱', label: '아이폰 쓰는 사람', query: '아이폰 쓰는 사람' },
  { icon: '🚗', label: '제네시스 타는 사람', query: '제네시스 타는 사람' },
  { icon: '👤', label: '서울 거주 30대 남성', query: '서울 거주 30대 남성' },
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
          <div className="mt-6 flex flex-col items-center gap-3 animate-fade-in">
            {/* 상단 3개: 가로 정렬 */}
            <div className="flex flex-wrap gap-3 justify-center">
              {QUICK_SUGGESTIONS.slice(0, 3).map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(suggestion.query);
                    handleSearch(suggestion.query);
                  }}
                  className="group flex items-center gap-2 px-5 py-3 bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-full text-sm font-medium text-slate-700 hover:bg-white hover:border-violet-300 hover:text-violet-600 hover:shadow-lg transition-all duration-200 shadow-md hover:scale-105"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <span className="text-xl">{suggestion.icon}</span>
                  <span>{suggestion.label}</span>
                </button>
              ))}
            </div>
            {/* 하단 1개: 중앙 정렬 */}
            {QUICK_SUGGESTIONS.length > 3 && (
              <div className="flex justify-center">
                {QUICK_SUGGESTIONS.slice(3).map((suggestion, idx) => (
                  <button
                    key={idx + 3}
                    onClick={() => {
                      setQuery(suggestion.query);
                      handleSearch(suggestion.query);
                    }}
                    className="group flex items-center gap-2 px-5 py-3 bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-full text-sm font-medium text-slate-700 hover:bg-white hover:border-violet-300 hover:text-violet-600 hover:shadow-lg transition-all duration-200 shadow-md hover:scale-105"
                    style={{ animationDelay: `${(idx + 3) * 100}ms` }}
                  >
                    <span className="text-xl">{suggestion.icon}</span>
                    <span>{suggestion.label}</span>
                  </button>
                ))}
              </div>
            )}
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
      {isSearching ? (
        <DashboardSkeleton />
      ) : hasSearched && ((searchResult?.unified?.count ?? 0) > 0 || allResults.length > 0) && searchResult ? (
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
      ) : hasSearched && error ? (
        <div className="relative z-10 w-full max-w-6xl mt-8" />
      ) : null}

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
