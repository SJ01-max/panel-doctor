
import React from 'react';
import { Download } from 'lucide-react';
import { KPIStatCard } from './KPIStatCard';
import { BarChartCard } from './BarChartCard';
import { DonutChartCard } from './DonutChartCard';
import type { PanelItem } from '../types/PanelItem';
import { SemanticResultList } from './SemanticResultList';
import { ComparisonDonutChart } from './ComparisonDonutChart';
import { ModernTable } from '../../../components/ModernTable';
import type { UnifiedSearchResponse } from '../../../api/search';
import type { LlmSqlResponse } from '../../../api/llm';

interface SearchResult {
  unified?: UnifiedSearchResponse;
  llm?: LlmSqlResponse;
}

interface ResultDashboardProps {
  searchResult: SearchResult;
  allResults: any[];
  isAnalyzing: boolean;
  tableData: any[];
  tableColumns: Array<{ key: string; label: string }>;
  widgets?: any[];
  highlightFilter: { type: string; value: string } | null;
  onDownloadExcel: () => void;
  onPanelClick: (panel: PanelItem) => void;
  hasSearched?: boolean;
  query?: string; // 검색 쿼리 추가
  activeFilters?: Array<{ label: string; value: string; type: string }>; // 활성 필터 추가
}

// Extract chart data from results (raw API response)
const extractChartData = (results: any[]) => {
  if (!results || results.length === 0) return { ageData: [], regionData: [] };
  
  // Age distribution - age_text 또는 age 필드 사용
  const ageCounts: Record<string, number> = {};
  results.forEach(row => {
    const ageText = row.age_text || row.age || '-';
    // '만 43세' 또는 '43세' 형식에서 나이만 추출 (년생 정보 완전 제거)
    let ageLabel = '-';
    
    // '만 XX세' 패턴 찾기 (백엔드에서 "만 43세" 형식으로 제공)
    const 만Match = ageText.match(/만\s*(\d+)세/);
    if (만Match) {
      ageLabel = `${만Match[1]}세`;
    } else {
      // 'XX세' 패턴 찾기 (년생 정보가 없는 경우)
      const 세Match = ageText.match(/(\d+)세/);
      if (세Match) {
        ageLabel = `${세Match[1]}세`;
      } else {
        // birth_year가 있으면 나이 계산
        if (row.birth_year) {
          const currentYear = new Date().getFullYear();
          const age = currentYear - row.birth_year;
          ageLabel = `${age}세`;
        }
      }
    }
    
    // 년생 정보가 포함된 경우 완전히 제거
    if (ageLabel.includes('년생')) {
      ageLabel = ageLabel.replace(/\d+년생\s*/g, '').trim();
      // 남은 부분에서 숫자 추출
      const cleanMatch = ageLabel.match(/(\d+)세/);
      if (cleanMatch) {
        ageLabel = `${cleanMatch[1]}세`;
      } else {
        ageLabel = '-';
      }
    }
    
    if (ageLabel !== '-') {
      ageCounts[ageLabel] = (ageCounts[ageLabel] || 0) + 1;
    }
  });
  
  // 연령대를 나이 순서대로 정렬 (오름차순), Top N 제한 없이 전체 표시
  const ageData = Object.entries(ageCounts)
    .map(([name, value]) => {
      // '43세'에서 숫자 추출하여 정렬 기준으로 사용
      const ageNum = parseInt(name.replace('세', '')) || 0;
      return { name, value, ageNum };
    })
    .sort((a, b) => a.ageNum - b.ageNum) // 나이 기준 오름차순 정렬
    .map(({ name, value }) => ({ name, value })); // Top N 제한 제거
  
  // Region distribution - 지역을 공백으로 자르고 첫 번째 단어만 사용
  const regionCounts: Record<string, number> = {};
  results.forEach(row => {
    const region = row.region || '-';
    // '서울 강남구' -> '서울', '경기 성남시' -> '경기'
    const mainRegion = region.split(/\s+/)[0] || region;
    regionCounts[mainRegion] = (regionCounts[mainRegion] || 0) + 1;
  });
  const regionData = Object.entries(regionCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value) // 인원수 기준 내림차순 (지역은 인원수 기준 정렬 유지)
    .slice(0, 5);
  
  return { ageData, regionData };
};

// 무한 스크롤 테이블 컴포넌트
const TableWithInfiniteScroll: React.FC<{
  allResults: any[];
  tableColumns: Array<{ key: string; label: string }>;
  highlightFilter: { type: string; value: string } | null;
}> = ({ allResults, tableColumns, highlightFilter }) => {
  const [visibleCount, setVisibleCount] = React.useState(20); // 초기 20개
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const isLoadingRef = React.useRef(false);

  // 테이블 데이터 변환
  const tableData = React.useMemo(() => {
    return allResults.slice(0, visibleCount).map((r, idx) => ({
      id: r.respondent_id || r.doc_id || `#${idx + 1}`,
      gender: r.gender || '-',
      age: r.age_text || '-',
      region: r.region || '-',
      content: r.content ? (r.content.length > 50 ? r.content.substring(0, 50) + '...' : r.content) : '-'
    }));
  }, [allResults, visibleCount]);

  // 스크롤 이벤트 핸들러
  React.useEffect(() => {
    const handleScroll = () => {
      if (isLoadingRef.current || visibleCount >= allResults.length) return;
      
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        // 스크롤이 하단 300px 이내에 도달하면 추가 로딩
        if (scrollHeight - scrollTop - clientHeight < 300) {
          isLoadingRef.current = true;
          // 20개씩 추가 로딩
          setVisibleCount(prev => {
            const next = Math.min(prev + 20, allResults.length);
            isLoadingRef.current = false;
            return next;
          });
        }
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [visibleCount, allResults.length]);

  return (
    <div 
      ref={scrollContainerRef}
      className="max-h-[600px] overflow-y-auto"
    >
      <ModernTable
        columns={tableColumns}
        data={tableData}
        highlightFilter={highlightFilter}
      />
      {visibleCount < allResults.length && (
        <div className="text-center py-4 text-sm text-gray-400 bg-slate-50/50">
          로딩 중... ({visibleCount} / {allResults.length})
        </div>
      )}
    </div>
  );
};

export const ResultDashboard: React.FC<ResultDashboardProps> = ({
  searchResult,
  allResults,
  isAnalyzing,
  tableData,
  tableColumns,
  highlightFilter,
  onDownloadExcel,
  onPanelClick,
  hasSearched = true,
  query = '',
  activeFilters = [],
}) => {
  // 전체 결과 데이터 (통계 계산용)
  const currentAllResults = allResults.length > 0 ? allResults : (searchResult?.unified?.results || []);
  
  // 🚀 [최적화] 통계 데이터는 'currentAllResults'가 바뀔 때만 딱 한 번 계산 (Memoization)
  const { ageData: memoizedAgeData, regionData: memoizedRegionData } = React.useMemo(() => {
    if (!currentAllResults || currentAllResults.length === 0) {
      return { ageData: [], regionData: [] };
    }
    return extractChartData(currentAllResults);
  }, [currentAllResults]);
  
  // 사용자가 요청한 조건 추출 (parsed_query에서)
  const parsedQuery = searchResult?.unified?.parsed_query;
  const requestedLimit = parsedQuery?.limit; // 사용자가 요청한 limit 추출
  const requestedFilters = parsedQuery?.filters || {};
  
  // ★ 총 패널 수 계산
  // 벡터 검색의 경우: 유사도 기반이므로 정확한 총 개수 계산이 어려움
  // 구조적 필터 + 키워드 필터가 있는 경우: 정확한 COUNT 쿼리 결과 사용
  // 벡터 검색만 있는 경우: 반환된 결과 개수 사용 (정확한 총 개수는 계산 불가)
  const actualResultCount = currentAllResults.length;
  const totalCountInDB = searchResult.unified?.total_count ?? searchResult.unified?.count ?? actualResultCount;
  
  // 전략에 따라 총 패널 수 결정
  const strategy = searchResult.unified?.strategy;
  let totalCount: number;
  
  // ★ 사용자가 limit을 요청했을 때는 실제 반환된 count를 사용
  if (requestedLimit && requestedLimit > 0) {
    // 사용자가 명시적으로 개수를 요청한 경우 (예: "100명")
    // 실제 반환된 결과 개수를 표시 (limit이 적용된 결과)
    totalCount = searchResult.unified?.count ?? actualResultCount;
  } else if (strategy === 'hybrid' && (requestedFilters.age || requestedFilters.gender || requestedFilters.region || searchResult.unified?.parsed_query?.semantic_keywords?.length)) {
    // 하이브리드 검색: 구조적 필터 + 키워드 필터가 있으면 정확한 COUNT 사용
    // (벡터 검색의 의미 매칭은 반영되지 않지만, 구조적 필터와 키워드 필터는 정확함)
    totalCount = totalCountInDB;
  } else if (strategy === 'filter_first') {
    // 필터 우선 검색: 정확한 COUNT 사용
    totalCount = totalCountInDB;
  } else {
    // 벡터 검색만 있는 경우: 반환된 결과 개수 사용 (정확한 총 개수는 계산 불가)
    // 벡터 검색은 유사도 기반이므로 정확한 총 개수를 계산하기 어려움
    totalCount = actualResultCount;
  }
  
  // 결과가 잘렸는지 확인 (total_count > 반환된 결과 개수)
  const isTruncated = totalCountInDB > actualResultCount;
  
  // 요청한 지역 (필터에서)
  const requestedRegion = requestedFilters.region || 
    activeFilters.find(f => f.label.includes('지역'))?.value || null;
  
  // 요청한 연령대 (필터에서)
  const requestedAge = requestedFilters.age || 
    activeFilters.find(f => f.label.includes('연령') || f.label.includes('나이'))?.value || null;
  
  // 연령대를 "20s" 형식에서 "20대"로 변환
  const formatAgeGroup = (age: string | undefined) => {
    if (!age) return null;
    if (age.includes('대')) return age;
    if (age.endsWith('s')) {
      const decade = age.replace('s', '');
      return `${decade}대`;
    }
    return age;
  };

  // 하이브리드 모드 여부 확인
  const isHybridMode = searchResult.unified?.strategy === 'hybrid';
  
  // 의미 기반 검색 전략인지 확인
  // semantic_first 또는 hybrid (의미 기반 조건 포함)인 경우 의미 기반 검색 UI 표시
  const hasSemanticContent = !!(parsedQuery?.semantic_keywords?.length);
  const isSemanticSearch = strategy === 'semantic_first' || (strategy === 'hybrid' && hasSemanticContent);
  
  // 필터 우선 검색인지 확인
  const isFilterFirst = strategy === 'filter_first';
  
  // 전략별 KPI 카드 라벨과 배지 설정
  const getStrategyConfig = () => {
    switch (strategy) {
      case 'filter_first':
        return {
          kpiLabel: '검색된 패널 (Total)',
          badge: { text: '✅ 조건 100% 일치', color: 'bg-green-100 text-green-700 border-green-200' },
          personaIcon: '📊',
          personaColor: 'from-blue-500 to-blue-600'
        };
      case 'semantic_first':
        return {
          kpiLabel: '연관 패널 (Relevant)',
          badge: { text: '🧠 의미 기반 매칭', color: 'bg-violet-100 text-violet-700 border-violet-200' },
          personaIcon: '🔮',
          personaColor: 'from-purple-500 to-purple-600'
        };
      case 'hybrid':
        return {
          kpiLabel: '타겟 그룹 (Target)',
          badge: { text: '🎯 필터 + AI 정밀 타겟팅', color: 'bg-blue-100 text-blue-700 border-blue-200' },
          personaIcon: '🎯',
          personaColor: 'from-indigo-500 to-indigo-600'
        };
      default:
        return {
          kpiLabel: '총 패널',
          badge: null,
          personaIcon: '📊',
          personaColor: 'from-blue-500 to-blue-600'
        };
    }
  };
  
  const strategyConfig = getStrategyConfig();
  
  // 의미 기반 검색인 경우 전용 UI 표시
  if (isSemanticSearch) {
    return (
      <SemanticResultList
        searchResult={searchResult}
        allResults={allResults}
        query={query}
        onPanelClick={onPanelClick}
        onDownloadExcel={onDownloadExcel}
      />
    );
  }
  
  return (
    <div className="relative z-10 w-full max-w-6xl mt-8 pb-20 animate-fade-in">
      {/* AI Insight Report - Full Width */}
      <section className="w-full rounded-3xl bg-white/80 backdrop-blur-xl shadow-[0_22px_55px_rgba(25,31,86,0.12)] overflow-hidden border border-white/70 mb-8">
        {/* 상단 그라데이션 헤더 */}
        <div className="w-full bg-gradient-to-r from-[#7c5cff] via-[#6b7dff] to-[#5bc3ff] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <span className="text-xl">📊</span>
            <h2 className="text-sm md:text-base font-semibold">
              AI Insight 리포트
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onDownloadExcel}
              className="flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-[#7c5cff] rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            >
              <Download size={16} />
              <span className="hidden sm:inline">데이터 내보내기</span>
              <span className="sm:hidden">내보내기</span>
            </button>
            <span className="text-[10px] md:text-xs text-white/80 hidden md:inline">
              최신 검색 조건 기준 자동 분석
            </span>
          </div>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="p-6 md:p-8 flex flex-col gap-6">
          {/* 하이브리드 모드가 아닐 때만 KPI 카드 표시 */}
          {!isHybridMode && (
            <>
              {/* KPI 카드 3개 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 총 패널: 전략별 라벨과 배지 적용 */}
            <div className="relative">
              <KPIStatCard
                icon="👤"
                title={strategyConfig.kpiLabel}
                value={`${totalCount.toLocaleString()}명`}
                bgColor="violet"
              />
              {strategyConfig.badge && (
                <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-semibold border ${strategyConfig.badge.color} shadow-sm`}>
                  {strategyConfig.badge.text}
                </div>
              )}
            </div>
            {/* 주요 거주지: 요청한 지역이 여러 개면 비중 계산, 단일 지역이면 100% 표시 */}
            {(() => {
              // 실제 검색 결과에서 지역별 비중 계산
              const regionCounts: Record<string, number> = {};
              currentAllResults.forEach(row => {
                const region = row.region || '-';
                const mainRegion = region.split(/\s+/)[0] || region; // '서울 강남구' -> '서울'
                regionCounts[mainRegion] = (regionCounts[mainRegion] || 0) + 1;
              });
              
              const regionEntries = Object.entries(regionCounts)
                .sort((a, b) => b[1] - a[1]);
              
              // 검색 결과 기준으로 통계 계산
              if (requestedRegion) {
                // 요청한 지역이 있는 경우
                const requestedRegions = requestedRegion.split(/[,\s]+|또는|이나|/).filter(r => r.trim().length > 0);
                const mainRequestedRegion = requestedRegions[0]?.split(/\s+/)[0] || requestedRegion.split(/\s+/)[0];
                
                // 요청한 지역이 여러 개인지 확인 (activeFilters에서도 확인)
                const regionFilters = activeFilters.filter(f => f.label.includes('지역'));
                const hasMultipleRegions = regionFilters.length > 1 || 
                  requestedRegions.length > 1 || 
                  requestedRegion.includes('또는') || 
                  requestedRegion.includes('이나') ||
                  requestedRegion.includes(',');
                
                if (hasMultipleRegions) {
                  // 여러 지역이 요청된 경우: 실제 결과에서 비중 계산 (totalCount 기준)
                  const topRegions = regionEntries.slice(0, 2); // 상위 2개 지역
                  
                  if (topRegions.length === 2) {
                    const [firstRegion, secondRegion] = topRegions;
                    // totalCount 기준으로 비율 계산 (실제 반환된 결과의 비율을 전체에 적용)
                    const firstRatio = firstRegion[1] / currentAllResults.length;
                    const secondRatio = secondRegion[1] / currentAllResults.length;
                    const firstPercentage = Math.round(firstRatio * 100);
                    const secondPercentage = Math.round(secondRatio * 100);
                    
                    return (
                      <KPIStatCard
                        icon="📍"
                        title="주요 거주지"
                        value={`${firstRegion[0]} ${firstPercentage}% · ${secondRegion[0]} ${secondPercentage}%`}
                        subtitle="요청 조건 기준"
                        bgColor="indigo"
                      />
                    );
                  } else if (topRegions.length === 1) {
                    const [firstRegion] = topRegions;
                    const firstRatio = firstRegion[1] / currentAllResults.length;
                    const firstPercentage = Math.round(firstRatio * 100);
                    
                    return (
                      <KPIStatCard
                        icon="📍"
                        title="주요 거주지"
                        value={`${firstRegion[0]} ${firstPercentage}%`}
                        subtitle="요청 조건 기준"
                        bgColor="indigo"
                      />
                    );
                  }
                } else {
                  // 단일 지역이 요청된 경우: 100%로 표시
                  return (
                    <KPIStatCard
                      icon="📍"
                      title="주요 거주지"
                      value={`${mainRequestedRegion} 100%`}
                      subtitle="요청 조건 기준"
                      bgColor="indigo"
                    />
                  );
                }
              }
              
              // 요청한 지역이 없으면 실제 결과 기반으로 계산
              const mainRegion = regionEntries.length > 0 ? regionEntries[0][0] : null;
              const mainRegionCount = regionEntries.length > 0 ? regionEntries[0][1] : 0;
              // 실제 반환된 결과의 비율을 전체 결과에 적용
              const regionRatio = currentAllResults.length > 0 
                ? mainRegionCount / currentAllResults.length 
                : 0;
              const regionPercentage = Math.round(regionRatio * 100);
              
              return mainRegion ? (
                <KPIStatCard
                  icon="📍"
                  title="주요 거주지"
                  value={`${mainRegion}${regionPercentage > 0 ? ` ${regionPercentage}%` : ''}`}
                  subtitle="응답 기준"
                  bgColor="indigo"
                />
              ) : null;
            })()}
            {/* 주요 연령대: 요청한 연령대가 있으면 100%로 표시 */}
            {(() => {
              const formattedAgeGroup = formatAgeGroup(requestedAge || undefined);
              
              if (formattedAgeGroup) {
                // 요청한 연령대가 있으면 100%로 표시
                return (
                  <KPIStatCard
                    icon="📅"
                    title="주요 연령대"
                    value={`${formattedAgeGroup} 100%`}
                    subtitle="요청 조건 기준"
                    bgColor="indigo"
                  />
                );
              }
              
              // 요청한 연령대가 없으면 검색 결과 기준으로 계산
              // 검색 결과로 반환된 실제 패널들 기준으로 연령대 분포 계산
              const ageGroupCounts: Record<string, number> = {};
              currentAllResults.forEach(row => {
                const ageText = row.age_text || row.age || '-';
                const ageMatch = ageText.match(/만\s*(\d+)세|(\d+)세/);
                if (ageMatch) {
                  const age = parseInt(ageMatch[1] || ageMatch[2]) || 0;
                  if (age >= 10 && age < 100) {
                    const ageGroup = Math.floor(age / 10) * 10;
                    const ageGroupLabel = `${ageGroup}대`;
                    ageGroupCounts[ageGroupLabel] = (ageGroupCounts[ageGroupLabel] || 0) + 1;
                  }
                }
              });
              const ageGroupEntries = Object.entries(ageGroupCounts)
                .sort((a, b) => b[1] - a[1]); // 가장 많은 연령대가 첫 번째
              const mainAgeGroup = ageGroupEntries.length > 0 ? ageGroupEntries[0][0] : null;
              const mainAgeGroupCount = ageGroupEntries.length > 0 ? ageGroupEntries[0][1] : 0;
              // 실제 반환된 결과의 비율을 전체 결과에 적용
              const ageRatio = currentAllResults.length > 0 
                ? mainAgeGroupCount / currentAllResults.length 
                : 0;
              const agePercentage = Math.round(ageRatio * 100);
              
              return mainAgeGroup ? (
                <KPIStatCard
                  icon="📅"
                  title="주요 연령대"
                  value={`${mainAgeGroup}${agePercentage > 0 ? ` ${agePercentage}%` : ''}`}
                  subtitle="응답 기준"
                  bgColor="indigo"
                />
              ) : null;
            })()}
              </div>

              {/* 분포 영역 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(() => {
              // filter_first 전략일 때는 백엔드에서 계산한 전체 검색 결과 기반 통계 사용
              let ageData: Array<{ name: string; value: number }> = [];
              
              if (isFilterFirst && searchResult.unified?.age_stats && searchResult.unified.age_stats.length > 0) {
                const backendAgeStats = searchResult.unified.age_stats;
                
                // 연령대가 하나만 있으면 각 연령별로 세분화해서 표시
                if (backendAgeStats.length === 1) {
                  // 단일 연령대: 각 연령별로 계산 (30대 -> 30세, 31세, 32세, ...)
                  const ageGroup = backendAgeStats[0].age_group || '';
                  const ageGroupNum = parseInt(ageGroup.replace('대', '').replace('s', '')) || 0;
                  
                  if (ageGroupNum >= 10 && ageGroupNum < 100) {
                    // 해당 연령대의 각 연령별 통계 계산
                    const ageCounts: Record<string, number> = {};
                    currentAllResults.forEach(row => {
                      const ageText = row.age_text || row.age || '-';
                      const ageMatch = ageText.match(/만\s*(\d+)세|(\d+)세/);
                      if (ageMatch) {
                        const age = parseInt(ageMatch[1] || ageMatch[2]) || 0;
                        // 해당 연령대 범위 내에 있는지 확인 (예: 30대 = 30~39세)
                        const ageDecade = Math.floor(age / 10) * 10;
                        if (ageDecade === ageGroupNum && age >= ageGroupNum && age < ageGroupNum + 10) {
                          const ageLabel = `${age}세`;
                          ageCounts[ageLabel] = (ageCounts[ageLabel] || 0) + 1;
                        }
                      }
                    });
                    
                    // 전체 검색 결과 수(totalCount)를 기준으로 비율 계산
                    const totalInDecade = backendAgeStats[0].age_count || 0;
                    const sampleTotal = Object.values(ageCounts).reduce((sum, count) => sum + count, 0);
                    
                    // 각 연령별 개수를 전체 검색 결과에 맞게 스케일링
                    ageData = Object.entries(ageCounts)
                      .map(([name, count]) => {
                        const scaledCount = sampleTotal > 0 
                          ? Math.round((count / sampleTotal) * totalInDecade)
                          : 0;
                        return {
                          name,
                          value: scaledCount,
                          ageNum: parseInt(name.replace('세', '')) || 0
                        };
                      })
                      .sort((a, b) => a.ageNum - b.ageNum)
                      .map(({ name, value }) => ({ name, value }));
                  } else {
                    // 연령대가 정상 범위가 아니면 백엔드 통계 그대로 사용
                    ageData = backendAgeStats.map((stat: any) => {
                      const ageGroup = stat.age_group || '';
                      const label = ageGroup.endsWith('s') 
                        ? `${ageGroup.replace('s', '')}대` 
                        : ageGroup.includes('대') 
                        ? ageGroup 
                        : `${ageGroup}대`;
                      return {
                        name: label,
                        value: stat.age_count || 0
                      };
                    });
                  }
                } else {
                  // 여러 연령대가 있으면 백엔드 통계 그대로 사용
                  ageData = backendAgeStats.map((stat: any) => {
                    const ageGroup = stat.age_group || '';
                    const label = ageGroup.endsWith('s') 
                      ? `${ageGroup.replace('s', '')}대` 
                      : ageGroup.includes('대') 
                      ? ageGroup 
                      : `${ageGroup}대`;
                    return {
                      name: label,
                      value: stat.age_count || 0
                    };
                  }).sort((a, b) => {
                    const ageA = parseInt(a.name.replace('대', '')) || 0;
                    const ageB = parseInt(b.name.replace('대', '')) || 0;
                    return ageA - ageB;
                  });
                }
              } else {
                // 백엔드 통계가 없으면 미리 계산된 메모이제이션된 데이터 사용 (fallback)
                ageData = memoizedAgeData;
              }
              
              return ageData.length > 0 ? (
                <BarChartCard
                  title="연령대 분포"
                  data={ageData}
                  subtitle="응답 비율 기준"
                />
              ) : null;
            })()}

            {(() => {
              // 단일 지역 필터가 있는 경우: 해당 지역을 100%로 표시
              if (requestedRegion) {
                // activeFilters에서 지역 필터 개수 확인 (더 정확함)
                const regionFilters = activeFilters.filter(f => f.label.includes('지역'));
                
                // requestedRegion에서 실제 지역명 추출 (공백 제거 후 첫 번째 단어만)
                const mainRequestedRegion = requestedRegion.trim().split(/\s+/)[0];
                
                // 여러 지역인지 확인: activeFilters에 지역 필터가 1개이고, requestedRegion에 구분자가 없으면 단일 지역
                const hasMultipleRegions = regionFilters.length > 1 || 
                  requestedRegion.includes('또는') || 
                  requestedRegion.includes('이나') ||
                  requestedRegion.includes(',') ||
                  requestedRegion.includes('/');
                
                console.log('[DEBUG] 지역 분포 계산:', {
                  requestedRegion,
                  mainRequestedRegion,
                  regionFiltersCount: regionFilters.length,
                  regionFilters: regionFilters.map(f => ({ label: f.label, value: f.value })),
                  hasMultipleRegions,
                  totalCount,
                  currentAllResultsLength: currentAllResults.length
                });
                
                // 단일 지역 필터인 경우: activeFilters에 지역 필터가 정확히 1개이고, 구분자가 없으면
                if (regionFilters.length === 1 && !hasMultipleRegions) {
                  // 단일 지역 필터: 해당 지역을 totalCount로 표시 (100%)
                  console.log('[DEBUG] 단일 지역 필터 적용:', {
                    mainRequestedRegion,
                    value: totalCount
                  });
                  return (
                    <DonutChartCard
                      title="지역 분포"
                      data={[{
                    name: mainRequestedRegion,
                    value: totalCount // 전체 검색 결과 수 사용
                      }]}
                      subtitle="패널 기준"
                      totalCount={totalCount} // totalCount 사용 (전체 검색 결과 수)
                    />
                  );
                }
              }
              
              // 여러 지역 필터이거나 지역 필터가 없는 경우
              let regionData: Array<{ name: string; value: number }> = [];
              
              if (isFilterFirst && searchResult.unified?.region_stats && searchResult.unified.region_stats.length > 0) {
                // 백엔드 region_stats 사용 (전체 검색 결과 기반)
                regionData = searchResult.unified.region_stats
                  .map((stat: any) => ({
                    name: stat.region || '',
                    value: stat.region_count || 0
                  }))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 5);
              } else {
                // 백엔드 통계가 없으면 미리 계산된 메모이제이션된 데이터 사용 (fallback)
                regionData = memoizedRegionData;
              }
              
              return regionData.length > 0 ? (
                <DonutChartCard
                  title="지역 분포"
                  data={regionData}
                  subtitle="패널 기준"
                  totalCount={totalCount} // totalCount 사용 (전체 검색 결과 수)
                />
              ) : null;
            })()}
              </div>
            </>
          )}

          {/* filter_first일 때만 전체 비율 대비 차트 표시 */}
          {isFilterFirst && (() => {
            const totalDatasetStats = searchResult.unified?.total_dataset_stats;
            if (!totalDatasetStats) {
              return null;
            }
            
            // 기준 집단 통계
            const referenceTotal = totalDatasetStats.total_count || 0;
            const referenceGenderStats = totalDatasetStats.gender_stats || [];
            const referenceAgeStats = totalDatasetStats.age_stats || [];
            const referenceRegionStats = totalDatasetStats.region_stats || [];
            
            // 지역 기준: 검색된 패널들이 "해당 지역 사는 사람들" 중에서 몇 %인지
            const getRegionComparison = () => {
              if (referenceRegionStats.length === 0) return null;
              
              // 1. 검색 조건에 지역 필터가 있으면 그 지역을 기준으로 사용
              let regionName: string | null = null;
              const regionFilter = activeFilters.find(f => f.label.includes('지역'));
              
              if (regionFilter) {
                // 지역명 추출 (첫 번째 단어만, 예: "서울" 또는 "서울 강남구" → "서울")
                const regionValue = regionFilter.value;
                regionName = regionValue.trim().split(/\s+/)[0];
              }
              
              // 2. 지역 필터가 없으면 검색된 패널에서 가장 많은 지역을 기준으로 사용
              if (!regionName) {
                // 검색된 패널에서 지역별 통계 계산
                const searchRegionCounts: Record<string, number> = {};
                currentAllResults.forEach(row => {
                  const region = row.region || '';
                  const mainRegion = region.split(/\s+/)[0] || region;
                  if (mainRegion) {
                    searchRegionCounts[mainRegion] = (searchRegionCounts[mainRegion] || 0) + 1;
                  }
                });
                const sortedRegions = Object.entries(searchRegionCounts).sort((a, b) => b[1] - a[1]);
                if (sortedRegions.length > 0) {
                  regionName = sortedRegions[0][0];
                }
              }
              
              // 3. 여전히 없으면 전체 데이터셋에서 가장 많은 지역 사용
              if (!regionName && referenceRegionStats.length > 0) {
                regionName = referenceRegionStats[0].region || '';
              }
              
              if (!regionName) return null;
              
              // 검색된 패널에서 해당 지역인 사람 수 계산
              let targetRegionCount = 0;
              currentAllResults.forEach(row => {
                const region = row.region || '';
                const mainRegion = region.split(/\s+/)[0] || region;
                if (mainRegion === regionName) {
                  targetRegionCount++;
                }
              });
              
              // 전체 검색 결과 수에 맞게 스케일링 (currentAllResults가 샘플인 경우)
              if (currentAllResults.length < totalCount && currentAllResults.length > 0) {
                const scaleFactor = totalCount / currentAllResults.length;
                targetRegionCount = Math.round(targetRegionCount * scaleFactor);
              }
              
              // 전체 데이터셋에서 해당 지역인 사람 수 찾기 (지역 필터만 적용)
              const regionInTotal = referenceRegionStats.find(r => r.region === regionName);
              const regionCountInTotal = regionInTotal?.count || 0;
              
              // 비율 계산
              const targetPercentage = totalCount > 0 ? Math.round((targetRegionCount / totalCount) * 100) : 0;
              // 전체 데이터: 해당 지역 사는 사람들 중에서 검색된 패널이 차지하는 비율
              const referencePercentage = regionCountInTotal > 0 ? Math.round((targetRegionCount / regionCountInTotal) * 100) : 0;
              
              return {
                region: regionName,
                targetCount: targetRegionCount,
                targetPercentage: targetPercentage,
                referenceCount: regionCountInTotal, // 해당 지역 사는 사람들 전체 수
                referencePercentage: referencePercentage,
                referenceDescription: `${regionName} 사는 사람들 전체`
              };
            };
            
            // 성별 기준: 검색된 패널들이 "지역 필터 적용된 상태에서 해당 성별인 사람들" 중에서 몇 %인지
            const getGenderComparison = () => {
              if (referenceGenderStats.length === 0) return null;
              
              // 1. 검색 조건에 성별 필터가 있으면 그 성별을 기준으로 사용
              let targetGenderKey: string | null = null;
              let genderLabel: string | null = null;
              const genderFilter = activeFilters.find(f => f.label.includes('성별'));
              
              if (genderFilter) {
                const genderValue = genderFilter.value;
                // 'M'/'F' 또는 '남'/'여' 형식 모두 지원
                if (genderValue === 'M' || genderValue === '남' || genderValue === '남성' || genderValue === '남자') {
                  targetGenderKey = 'M';
                  genderLabel = '남';
                } else if (genderValue === 'F' || genderValue === '여' || genderValue === '여성' || genderValue === '여자') {
                  targetGenderKey = 'F';
                  genderLabel = '여';
                } else {
                  targetGenderKey = genderValue;
                  genderLabel = genderValue;
                }
              }
              
              // 2. 성별 필터가 없으면 검색된 패널에서 가장 많은 성별을 기준으로 사용
              if (!targetGenderKey) {
                const searchGenderCounts: Record<string, number> = {};
                currentAllResults.forEach(row => {
                  const gender = (row.gender || '').toString();
                  let key: string;
                  if (['M', '남', '남성', '남자'].some(v => gender.includes(v))) key = 'M';
                  else if (['F', '여', '여성', '여자'].some(v => gender.includes(v))) key = 'F';
                  else key = '기타';
                  searchGenderCounts[key] = (searchGenderCounts[key] || 0) + 1;
                });
                const sortedGenders = Object.entries(searchGenderCounts).sort((a, b) => b[1] - a[1]);
                if (sortedGenders.length > 0 && sortedGenders[0][0] !== '기타') {
                  const mainGenderKey = sortedGenders[0][0];
                  if (mainGenderKey === 'M') {
                    targetGenderKey = 'M';
                    genderLabel = '남';
                  } else if (mainGenderKey === 'F') {
                    targetGenderKey = 'F';
                    genderLabel = '여';
                  }
                }
              }
              
              // 3. 여전히 없으면 전체 데이터셋에서 가장 많은 성별 사용
              if (!targetGenderKey && referenceGenderStats.length > 0) {
                const mainGender = referenceGenderStats[0].gender || '';
                if (mainGender === 'M' || mainGender === '남') {
                  targetGenderKey = 'M';
                  genderLabel = '남';
                } else if (mainGender === 'F' || mainGender === '여') {
                  targetGenderKey = 'F';
                  genderLabel = '여';
                } else {
                  targetGenderKey = mainGender;
                  genderLabel = mainGender;
                }
              }
              
              if (!targetGenderKey || !genderLabel) return null;
              
              // 검색된 패널에서 해당 성별인 사람 수 계산
              let targetGenderCount = 0;
              currentAllResults.forEach(row => {
                const gender = (row.gender || '').toString();
                if (targetGenderKey === 'M' && ['M', '남', '남성', '남자'].some(v => gender.includes(v))) {
                  targetGenderCount++;
                } else if (targetGenderKey === 'F' && ['F', '여', '여성', '여자'].some(v => gender.includes(v))) {
                  targetGenderCount++;
                }
              });
              
              // 전체 검색 결과 수에 맞게 스케일링 (currentAllResults가 샘플인 경우)
              if (currentAllResults.length < totalCount && currentAllResults.length > 0) {
                const scaleFactor = totalCount / currentAllResults.length;
                targetGenderCount = Math.round(targetGenderCount * scaleFactor);
              }
              
              // 지역 필터가 있으면 해당 지역에서 해당 성별인 사람 수를 계산
              // 지역 필터가 없으면 DB 전체에서 해당 성별인 사람 수 사용
              let genderCountInTotal = 0;
              const genderRegionFilter = activeFilters.find(f => f.label.includes('지역'));
              
              if (genderRegionFilter) {
                // 지역 필터가 있는 경우: 해당 지역에서 해당 성별인 사람 수를 근사치로 계산
                // (실제로는 백엔드에서 정확한 통계를 가져와야 하지만, 여기서는 근사치 사용)
                const regionValue = genderRegionFilter.value.trim().split(/\s+/)[0];
                const regionInTotal = referenceRegionStats.find(r => r.region === regionValue);
                const regionCountInTotal = regionInTotal?.count || 0;
                
                // DB 전체에서 해당 성별인 사람 수
                const genderInTotal = referenceGenderStats.find(g => {
                  const gKey = g.gender;
                  if (targetGenderKey === 'M') return gKey === 'M' || gKey === '남';
                  if (targetGenderKey === 'F') return gKey === 'F' || gKey === '여';
                  return gKey === targetGenderKey;
                });
                const genderCountInDB = genderInTotal?.count || 0;
                
                // 해당 지역에서 해당 성별인 사람 수 = (지역 비율) * (성별 비율) * 전체 인원 수
                // 더 정확하게는: (지역 인원 수) * (해당 지역 내 성별 비율)
                // 근사치로: (지역 인원 수) * (전체 성별 비율)
                const genderRatioInDB = referenceTotal > 0 ? genderCountInDB / referenceTotal : 0;
                genderCountInTotal = Math.round(regionCountInTotal * genderRatioInDB);
              } else {
                // 지역 필터가 없는 경우: DB 전체에서 해당 성별인 사람 수
                const genderInTotal = referenceGenderStats.find(g => {
                  const gKey = g.gender;
                  if (targetGenderKey === 'M') return gKey === 'M' || gKey === '남';
                  if (targetGenderKey === 'F') return gKey === 'F' || gKey === '여';
                  return gKey === targetGenderKey;
                });
                genderCountInTotal = genderInTotal?.count || 0;
              }
              
              // 비율 계산
              const targetPercentage = totalCount > 0 ? Math.round((targetGenderCount / totalCount) * 100) : 0;
              // 전체 데이터: (지역 필터 적용된 상태에서) 해당 성별인 사람들 중에서 검색된 패널이 차지하는 비율
              const referencePercentage = genderCountInTotal > 0 ? Math.round((targetGenderCount / genderCountInTotal) * 100) : 0;
                  
              // 전체 데이터 설명 생성
              let referenceDesc = '';
              if (genderRegionFilter) {
                const regionValue = genderRegionFilter.value.trim().split(/\s+/)[0];
                referenceDesc = `${regionValue} 사는 ${genderLabel}들 전체`;
              } else {
                referenceDesc = `${genderLabel}들 전체`;
                  }
                  
                  return {
                gender: genderLabel,
                targetCount: targetGenderCount,
                targetPercentage: targetPercentage,
                referenceCount: genderCountInTotal, // (지역 필터 적용된 상태에서) 해당 성별인 사람들 전체 수
                referencePercentage: referencePercentage,
                referenceDescription: referenceDesc
              };
            };
            
            // 연령 기준: 검색된 패널들이 "지역 필터 적용된 상태에서 해당 연령대인 사람들" 중에서 몇 %인지
            const getAgeComparison = () => {
              if (referenceAgeStats.length === 0) return null;
              
              // 1. 검색 조건에 연령 필터가 있으면 그 연령대를 기준으로 사용
              let ageGroup: string | null = null;
              const ageFilter = activeFilters.find(f => f.label.includes('연령') || f.label.includes('나이'));
              
              if (ageFilter) {
                // "20s" 형식을 "20대"로 변환
                const ageValue = ageFilter.value;
                if (ageValue.includes('s')) {
                  const decade = ageValue.replace('s', '');
                  ageGroup = `${decade}대`;
                } else if (ageValue.includes('대')) {
                  ageGroup = ageValue;
                } else {
                  // 숫자만 있는 경우 (예: "20" → "20대")
                  const decade = parseInt(ageValue);
                  if (!isNaN(decade)) {
                    ageGroup = `${decade}대`;
                  }
                }
              }
              
              // 2. 연령 필터가 없으면 검색된 패널에서 가장 많은 연령대를 기준으로 사용
              if (!ageGroup) {
                const searchAgeCounts: Record<string, number> = {};
                currentAllResults.forEach(row => {
                  const ageText = row.age_text || row.age || '';
                  const ageMatch = ageText.match(/만\s*(\d+)세|(\d+)세/);
                  if (ageMatch) {
                    const ageNum = parseInt(ageMatch[1] || ageMatch[2]);
                    if (ageNum >= 10 && ageNum < 100) {
                      const decade = Math.floor(ageNum / 10) * 10;
                      const ageGroupKey = `${decade}대`;
                      searchAgeCounts[ageGroupKey] = (searchAgeCounts[ageGroupKey] || 0) + 1;
                    }
                  }
                });
                const sortedAges = Object.entries(searchAgeCounts).sort((a, b) => b[1] - a[1]);
                if (sortedAges.length > 0) {
                  ageGroup = sortedAges[0][0];
                }
              }
              
              // 3. 여전히 없으면 전체 데이터셋에서 가장 많은 연령대 사용
              if (!ageGroup && referenceAgeStats.length > 0) {
                ageGroup = referenceAgeStats[0].age_group || '';
              }
              
              if (!ageGroup) return null;
              
              // 검색된 패널에서 해당 연령대인 사람 수 계산
              let targetAgeCount = 0;
              currentAllResults.forEach(row => {
                const ageText = row.age_text || row.age || '';
                const ageMatch = ageText.match(/만\s*(\d+)세|(\d+)세/);
                if (ageMatch) {
                  const ageNum = parseInt(ageMatch[1] || ageMatch[2]);
                  if (ageNum >= 10 && ageNum < 100) {
                    const decade = Math.floor(ageNum / 10) * 10;
                    const ageGroupKey = `${decade}대`;
                    if (ageGroupKey === ageGroup) {
                      targetAgeCount++;
                    }
                  }
                }
              });
              
              // 전체 검색 결과 수에 맞게 스케일링 (currentAllResults가 샘플인 경우)
              if (currentAllResults.length < totalCount && currentAllResults.length > 0) {
                const scaleFactor = totalCount / currentAllResults.length;
                targetAgeCount = Math.round(targetAgeCount * scaleFactor);
              }
              
              // 지역 필터가 있으면 해당 지역에서 해당 연령대인 사람 수를 계산
              // 지역 필터가 없으면 DB 전체에서 해당 연령대인 사람 수 사용
              let ageCountInTotal = 0;
              const ageRegionFilter = activeFilters.find(f => f.label.includes('지역'));
              
              if (ageRegionFilter) {
                // 지역 필터가 있는 경우: 해당 지역에서 해당 연령대인 사람 수를 근사치로 계산
                const regionValue = ageRegionFilter.value.trim().split(/\s+/)[0];
                const regionInTotal = referenceRegionStats.find(r => r.region === regionValue);
                const regionCountInTotal = regionInTotal?.count || 0;
                
                // DB 전체에서 해당 연령대인 사람 수
                const ageInTotal = referenceAgeStats.find(a => a.age_group === ageGroup);
                const ageCountInDB = ageInTotal?.count || 0;
                
                // 해당 지역에서 해당 연령대인 사람 수 = (지역 비율) * (연령대 비율) * 전체 인원 수
                // 근사치로: (지역 인원 수) * (전체 연령대 비율)
                const ageRatioInDB = referenceTotal > 0 ? ageCountInDB / referenceTotal : 0;
                ageCountInTotal = Math.round(regionCountInTotal * ageRatioInDB);
              } else {
                // 지역 필터가 없는 경우: DB 전체에서 해당 연령대인 사람 수
                const ageInTotal = referenceAgeStats.find(a => a.age_group === ageGroup);
                ageCountInTotal = ageInTotal?.count || 0;
              }
              
              // 비율 계산
              const targetPercentage = totalCount > 0 ? Math.round((targetAgeCount / totalCount) * 100) : 0;
              // 전체 데이터: (지역 필터 적용된 상태에서) 해당 연령대인 사람들 중에서 검색된 패널이 차지하는 비율
              const referencePercentage = ageCountInTotal > 0 ? Math.round((targetAgeCount / ageCountInTotal) * 100) : 0;
                  
              // 전체 데이터 설명 생성
              let referenceDesc = '';
              if (ageRegionFilter) {
                const regionValue = ageRegionFilter.value.trim().split(/\s+/)[0];
                referenceDesc = `${regionValue} 사는 ${ageGroup} 전체`;
              } else {
                referenceDesc = `${ageGroup} 전체`;
              }
                  
                  return {
                ageGroup: ageGroup,
                targetCount: targetAgeCount,
                targetPercentage: targetPercentage,
                referenceCount: ageCountInTotal, // (지역 필터 적용된 상태에서) 해당 연령대인 사람들 전체 수
                referencePercentage: referencePercentage,
                referenceDescription: referenceDesc
              };
            };
            
            const regionComp = getRegionComparison();
            const genderComp = getGenderComparison();
            const ageComp = getAgeComparison();
            
            return (
              <div className="mt-6">
                <div className="mb-5 text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">전체 데이터 대비 검색 결과 비교</h3>
                  <p className="text-xs text-gray-500 px-4">
                    <span className="font-medium text-violet-600">검색 결과</span>: 검색된 패널 중 해당 조건을 만족하는 사람 수 · 
                    <span className="font-medium text-gray-600"> 전체 데이터</span>: 비교 기준 집단에서 해당 조건을 만족하는 사람 수
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* 지역 기준 */}
                  {regionComp && (
                    <ComparisonDonutChart
                      title="지역 기준"
                      targetLabel="검색 결과"
                      targetCount={regionComp.targetCount}
                      targetPercentage={regionComp.targetPercentage}
                      referenceLabel="전체 데이터"
                      referenceCount={regionComp.referenceCount}
                      referencePercentage={regionComp.referencePercentage}
                      detailLabel={regionComp.region}
                      referenceDescription={regionComp.referenceDescription}
                    />
                  )}
                  
                  {/* 성별 기준 */}
                  {genderComp && (
                    <ComparisonDonutChart
                      title="성별 기준"
                      targetLabel="검색 결과"
                      targetCount={genderComp.targetCount}
                      targetPercentage={genderComp.targetPercentage}
                      referenceLabel="전체 데이터"
                      referenceCount={genderComp.referenceCount}
                      referencePercentage={genderComp.referencePercentage}
                      detailLabel={genderComp.gender}
                      referenceDescription={genderComp.referenceDescription}
                    />
                  )}
                  
                  {/* 연령 기준 */}
                  {ageComp && (
                    <ComparisonDonutChart
                      title="연령 기준"
                      targetLabel="검색 결과"
                      targetCount={ageComp.targetCount}
                      targetPercentage={ageComp.targetPercentage}
                      referenceLabel="전체 데이터"
                      referenceCount={ageComp.referenceCount}
                      referencePercentage={ageComp.referencePercentage}
                      detailLabel={ageComp.ageGroup}
                      referenceDescription={ageComp.referenceDescription}
              />
            )}
          </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Data Table - filter_first일 때는 테이블만 표시, hybrid/semantic_first일 때는 리치 리스트 */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/50 shadow-sm overflow-hidden data-table mt-8">
        <div className="p-4 border-b border-slate-200/50 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
          <h3 className="font-semibold text-slate-700">
            {isFilterFirst ? '데이터 테이블 (정확한 조건 일치)' : '패널 리스트 (적합도 순)'}
          </h3>
          <button
            onClick={onDownloadExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-violet-600 transition-colors shadow-sm"
          >
            <Download size={16} /> 엑셀 다운로드
          </button>
        </div>
        
        {/* ★ 경고 배너: 결과가 잘렸을 때 표시 */}
        {isTruncated && (
          <div className="bg-amber-50 text-amber-800 p-3 rounded-lg m-4 text-sm flex items-center justify-center gap-2 border border-amber-200">
            <span className="text-lg">⚠️</span>
            <span>
              검색된 <strong>{totalCount.toLocaleString()}명</strong> 중 상위 <strong>{currentAllResults.length.toLocaleString()}명</strong>만 미리보기로 표시됩니다. 
              전체 데이터는 <strong className="text-amber-900 underline cursor-pointer" onClick={onDownloadExcel}>[엑셀 다운로드]</strong>를 이용하세요.
            </span>
          </div>
        )}
        
        <TableWithInfiniteScroll
          allResults={currentAllResults}
          tableColumns={tableColumns}
          highlightFilter={highlightFilter}
        />
      </div>
    </div>
  );
};

