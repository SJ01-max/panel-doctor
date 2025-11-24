import React from 'react';
import { Download } from 'lucide-react';
import { KPIStatCard } from './KPIStatCard';
import { BarChartCard } from './BarChartCard';
import { DonutChartCard } from './DonutChartCard';
import { PersonaCard } from './PersonaCard';
import { PanelListCard, type PanelItem } from './PanelListCard';
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
  activeFilters?: Array<{ label: string; value: string }>; // 활성 필터 추가
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
  activeFilters = [],
}) => {
  // 전체 결과 데이터 (통계 계산용)
  const currentAllResults = allResults.length > 0 ? allResults : (searchResult?.unified?.results || []);
  
  // 사용자가 요청한 조건 추출 (parsed_query에서)
  const parsedQuery = searchResult?.unified?.parsed_query;
  const requestedLimit = parsedQuery?.limit;
  const requestedFilters = parsedQuery?.filters || {};
  
  // 요청한 개수 (limit이 있으면 사용, 없으면 실제 결과 개수)
  const displayCount = requestedLimit || searchResult.unified?.count || currentAllResults.length;
  
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
          {/* KPI 카드 3개 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 총 패널: 요청한 limit이 있으면 그 값 사용, 없으면 실제 결과 개수 */}
            <KPIStatCard
              icon="👤"
              title="총 패널"
              value={`${displayCount.toLocaleString()}명`}
              bgColor="violet"
            />
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
              
              const totalCount = displayCount;
              
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
                  // 여러 지역이 요청된 경우: 실제 결과에서 비중 계산
                  const topRegions = regionEntries.slice(0, 2); // 상위 2개 지역
                  
                  if (topRegions.length === 2) {
                    const [firstRegion, secondRegion] = topRegions;
                    const firstPercentage = Math.round((firstRegion[1] / totalCount) * 100);
                    const secondPercentage = Math.round((secondRegion[1] / totalCount) * 100);
                    
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
                    const firstPercentage = Math.round((firstRegion[1] / totalCount) * 100);
                    
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
              const regionPercentage = mainRegionCount > 0 && totalCount > 0
                ? Math.round((mainRegionCount / totalCount) * 100)
                : 0;
              
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
              
              // 요청한 연령대가 없으면 실제 결과 기반으로 계산
              const ageStats = searchResult.unified?.age_stats || [];
              const totalCount = displayCount;
              
              let mainAgeGroup: string | null = null;
              let agePercentage = 0;
              
              if (ageStats.length > 0) {
                const sortedAgeStats = [...ageStats].sort((a: any, b: any) => 
                  (b.age_count || 0) - (a.age_count || 0)
                );
                const topAgeStat = sortedAgeStats[0];
                mainAgeGroup = topAgeStat?.age_group || null;
                const mainAgeGroupCount = topAgeStat?.age_count || 0;
                agePercentage = mainAgeGroupCount > 0 && totalCount > 0
                  ? Math.round((mainAgeGroupCount / totalCount) * 100)
                  : 0;
              } else {
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
                  .sort((a, b) => b[1] - a[1]);
                mainAgeGroup = ageGroupEntries.length > 0 ? ageGroupEntries[0][0] : null;
                const mainAgeGroupCount = ageGroupEntries.length > 0 ? ageGroupEntries[0][1] : 0;
                agePercentage = mainAgeGroupCount > 0 && totalCount > 0
                  ? Math.round((mainAgeGroupCount / totalCount) * 100)
                  : 0;
              }
              
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
              // 전체 결과 데이터로 통계 계산
              const { ageData } = extractChartData(currentAllResults);
              return ageData.length > 0 ? (
                <BarChartCard
                  title="연령대 분포"
                  data={ageData}
                  subtitle="응답 비율 기준"
                />
              ) : null;
            })()}

            {(() => {
              // 백엔드에서 제공한 지역별 통계 사용 (전체 검색 결과 기반)
              const regionStats = searchResult.unified?.region_stats || [];
              const totalCount = searchResult.unified?.count || currentAllResults.length;
              
              let regionData: Array<{ name: string; value: number }> = [];
              
              if (regionStats.length > 0) {
                // 백엔드 통계 사용 (전체 검색 결과 기반)
                regionData = regionStats
                  .map((stat: any) => {
                    const region = stat.region || stat.region_group || '-';
                    // '서울 강남구' -> '서울'로 변환
                    const mainRegion = region.split(/\s+/)[0] || region;
                    return { name: mainRegion, value: stat.region_count || stat.count || 0 };
                  })
                  .filter((item: any) => item.name !== '-')
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 5);
              } else {
                // 백엔드 통계가 없으면 프론트엔드에서 계산 (표본 기반)
                const { regionData: sampleRegionData } = extractChartData(currentAllResults);
                regionData = sampleRegionData;
              }
              
              return regionData.length > 0 ? (
                <DonutChartCard
                  title="지역 분포"
                  data={regionData}
                  subtitle="패널 기준"
                  totalCount={totalCount}
                />
              ) : null;
            })()}
          </div>

          {/* AI 페르소나 & 패널 리스트 프리뷰 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 페르소나 카드: 로딩 중이거나 데이터가 있으면 항상 표시 */}
            {(isAnalyzing || searchResult.llm?.persona) && (
              <PersonaCard
                persona={searchResult.llm?.persona}
                isLoading={isAnalyzing}
                hasSearched={hasSearched}
              />
            )}

            {tableData && tableData.length > 0 && (
              <PanelListCard
                panels={tableData.map((row, i) => {
                  // 요청한 필터 조건과 실제 패널 데이터를 비교하여 일치율 계산
                  let matchScore: number = 100; // 기본값 100%
                  
                  // 요청한 필터 조건 추출
                  const requestedFilters = parsedQuery?.filters || {};
                  const requestedAge = requestedFilters.age;
                  const requestedGender = requestedFilters.gender;
                  const requestedRegion = requestedFilters.region;
                  
                  // 일치 조건 개수와 전체 조건 개수 계산
                  let matchedConditions = 0;
                  let totalConditions = 0;
                  
                  // 연령 조건 체크
                  if (requestedAge) {
                    totalConditions++;
                    const panelAge = row.age || '';
                    const ageMatch = panelAge.match(/만\s*(\d+)세|(\d+)세/);
                    if (ageMatch) {
                      const panelAgeNum = parseInt(ageMatch[1] || ageMatch[2]) || 0;
                      // "50s" -> 50-59, "20s" -> 20-29 등으로 변환
                      if (requestedAge.endsWith('s')) {
                        const decade = parseInt(requestedAge.replace('s', '')) || 0;
                        if (panelAgeNum >= decade && panelAgeNum < decade + 10) {
                          matchedConditions++;
                        }
                      } else if (requestedAge.includes('대')) {
                        const decade = parseInt(requestedAge.replace('대', '')) || 0;
                        if (panelAgeNum >= decade && panelAgeNum < decade + 10) {
                          matchedConditions++;
                        }
                      } else if (requestedAge.includes('이상') || requestedAge.includes('이상')) {
                        const minAge = parseInt(requestedAge.replace(/[^0-9]/g, '')) || 0;
                        if (panelAgeNum >= minAge) {
                          matchedConditions++;
                        }
                      }
                    }
                  }
                  
                  // 성별 조건 체크
                  if (requestedGender) {
                    totalConditions++;
                    const panelGender = row.gender || '';
                    // 성별 매칭 (M/남/남성, F/여/여성)
                    const genderMap: Record<string, string[]> = {
                      'M': ['M', '남', '남성', '남자'],
                      'F': ['F', '여', '여성', '여자'],
                      '남': ['M', '남', '남성', '남자'],
                      '여': ['F', '여', '여성', '여자'],
                      '남성': ['M', '남', '남성', '남자'],
                      '여성': ['F', '여', '여성', '여자'],
                    };
                    const requestedGenderVariants = genderMap[requestedGender] || [requestedGender];
                    if (requestedGenderVariants.some(v => panelGender.includes(v))) {
                      matchedConditions++;
                    }
                  }
                  
                  // 지역 조건 체크
                  if (requestedRegion) {
                    totalConditions++;
                    const panelRegion = row.region || '';
                    // 여러 지역이 요청된 경우 (예: "부산이나 대구")
                    const requestedRegions = requestedRegion.split(/[,\s]+|또는|이나/).filter(r => r.trim().length > 0);
                    const mainRequestedRegions = requestedRegions.map(r => r.split(/\s+/)[0]); // '서울 강남구' -> '서울'
                    const mainPanelRegion = panelRegion.split(/\s+/)[0]; // '부산 해운대구' -> '부산'
                    
                    if (mainRequestedRegions.some(r => mainPanelRegion.includes(r) || r.includes(mainPanelRegion))) {
                      matchedConditions++;
                    }
                  }
                  
                  // 일치율 계산 (조건이 없으면 100%, 있으면 일치한 조건 비율)
                  if (totalConditions > 0) {
                    matchScore = Math.round((matchedConditions / totalConditions) * 100);
                  }
                  
                  return {
                    id: row.id || `R-${String(i + 1).padStart(3, '0')}`,
                    gender: row.gender || '-',
                    age: row.age || '-',
                    region: row.region || '-',
                    lastResponseDate: undefined,
                    matchScore: matchScore
                  };
                })}
                onPanelClick={onPanelClick}
                maxItems={4}
              />
            )}
          </div>
        </div>
      </section>

      {/* Data Table */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/50 shadow-sm overflow-hidden data-table mt-8">
        <div className="p-4 border-b border-slate-200/50 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
          <h3 className="font-semibold text-slate-700">데이터 미리보기</h3>
          <button
            onClick={onDownloadExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-violet-600 transition-colors shadow-sm"
          >
            <Download size={16} /> 엑셀 다운로드
          </button>
        </div>
        <TableWithInfiniteScroll
          allResults={currentAllResults}
          tableColumns={tableColumns}
          highlightFilter={highlightFilter}
        />
      </div>
    </div>
  );
};

