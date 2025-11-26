import { useState, useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { unifiedSearch, type UnifiedSearchResponse } from '../../../api/search';
import { sqlSearch, type LlmSqlResponse } from '../../../api/llm';

const EXAMPLE_QUERIES = [
  "서울 20대 남자 100명",
  "30대 여성 중 수면부족인 사람들",
  "전국 직장인 중 스트레스 높은 그룹",
  "40대 이상 운동부족 패널",
  "서울/경기 지역 20-30대"
];

interface SearchResult {
  unified?: UnifiedSearchResponse;
  llm?: LlmSqlResponse;
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

export const usePanelSearch = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false); // 1차 DB 검색용 로딩 상태
  const [isAnalyzing, setIsAnalyzing] = useState(false); // 2차 AI 요약용 로딩 상태
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [activeFilters, setActiveFilters] = useState<Array<{ label: string; value: string; type: string }>>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [highlightFilter, setHighlightFilter] = useState<{ type: string; value: string } | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);
  const [selectedPanelData, setSelectedPanelData] = useState<{ 
    id: string; 
    gender: string; 
    age: string; 
    region: string;
    matchScore?: number;
    content?: string;
    semanticKeywords?: string[];
  } | null>(null);
  const [allResults, setAllResults] = useState<any[]>([]); // 검색 결과를 별도 state로 관리
  const autoSearchExecuted = useRef(false);
  const currentUnifiedResultRef = useRef<UnifiedSearchResponse | null>(null); // 현재 unifiedResult를 ref로 저장

  // URL 쿼리 파라미터에서 초기 검색어 가져오기
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !autoSearchExecuted.current) {
      setQuery(q);
      autoSearchExecuted.current = true;
      setTimeout(() => {
        handleSearch(q);
      }, 100);
    }
  }, [searchParams]);

  // location state에서 initialQuery를 받아서 자동 검색
  useEffect(() => {
    const state = location.state as { initialQuery?: string; autoSearch?: boolean } | null;
    if (state?.initialQuery && state?.autoSearch && !autoSearchExecuted.current) {
      setQuery(state.initialQuery);
      autoSearchExecuted.current = true;
      setTimeout(() => {
        handleSearch(state.initialQuery!);
      }, 100);
    }
  }, [location.state]);

  // 실시간 추천 검색어
  useEffect(() => {
    if (query.length > 2 && !hasSearched) {
      const filtered = EXAMPLE_QUERIES.filter(q => 
        q.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 3);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [query, hasSearched]);

  const handleSearch = async (searchQuery?: string) => {
    const queryToUse = searchQuery || query;
    console.log('[🔍 SEARCH] handleSearch 시작:', { queryToUse, isSearching });
    
    if (!queryToUse.trim() || isSearching) {
      console.log('[🔍 SEARCH] 검색 중단:', { queryEmpty: !queryToUse.trim(), isSearching });
      return;
    }

    // 1차 DB 검색 시작
    console.log('[🔍 SEARCH] 1차 DB 검색 시작 - isSearching = true');
    setIsSearching(true);
    setError(null);
    setQuery(queryToUse);
    // ref 초기화
    currentUnifiedResultRef.current = null;
    // 이전 결과는 유지 (검색 결과가 오면 덮어쓰기)
    setActiveFilters([]); // 필터 초기화
    setWidgets([]); // 위젯 초기화
    setHighlightFilter(null); // 하이라이트 필터 초기화

    try {
      // 1. 먼저 DB 검색 결과 가져오기 (빠름)
      console.log('[🔍 SEARCH] unifiedSearch API 호출 시작...');
      const unifiedResult = await unifiedSearch(queryToUse.trim());
      console.log('[🔍 SEARCH] unifiedSearch 응답 받음:', {
        has_results: unifiedResult?.has_results,
        count: unifiedResult?.count,
        resultsLength: unifiedResult?.results?.length,
        strategy: unifiedResult?.strategy
      });
      
      if (unifiedResult && unifiedResult.has_results && unifiedResult.count > 0) {
        // ... (필터 설정 부분은 그대로 유지) ...
        // 필터 칩 생성 (age 또는 age_range 모두 지원)
        const parsedFilters = unifiedResult.parsed_query?.filters || {};
        const ageFilter = (parsedFilters.age || parsedFilters.age_range) as string | undefined;
        const filters: Array<{ label: string; value: string; type: string }> = [];
        if (ageFilter) {
          filters.push({ label: '연령', value: ageFilter, type: 'age' });
        }
        if (parsedFilters.gender) {
          filters.push({ label: '성별', value: parsedFilters.gender as string, type: 'gender' });
        }
        if (parsedFilters.region) {
          filters.push({ label: '지역', value: parsedFilters.region as string, type: 'region' });
        }
        setActiveFilters(filters);

        // 즉시 검색 결과 렌더링 준비
        const results = unifiedResult.results || [];
        currentUnifiedResultRef.current = unifiedResult;
        
        // startTransition 제거 - 즉시 렌더링
        setAllResults(results);
        setSearchResult({
          unified: unifiedResult,
          llm: undefined // 기존 페르소나 데이터 초기화
        });
        
        // 1. 분석 상태 먼저 켜기 (방어막 구축)
        setIsAnalyzing(true);
        
        // 2. 검색 로딩 끄기 (이 시점에 무조건 리렌더링 발생)
        setIsSearching(false);
        setHasSearched(true);

        // 3. 그 다음 비동기 호출
        loadInsightAsync(queryToUse.trim(), unifiedResult).catch(err => {
          console.warn('AI 분석 실패:', err);
          setIsAnalyzing(false); // 실패 시에만 로딩 끄기
        });

      } else {
        // 결과 없을 때 처리
        setIsAnalyzing(false); // 여기는 확실히 꺼줘야 함
        setIsSearching(false);
        setError('검색 결과가 없습니다.');
        setHasSearched(true);
      }
    } catch (err: any) {
      console.error('검색 오류:', err);
      setError(err?.message || '검색 중 오류가 발생했습니다.');
      setHasSearched(true);
      setIsSearching(false);
      setIsAnalyzing(false);
    }
  };

  // AI Insight를 별도로 비동기 로드하는 함수
  const loadInsightAsync = async (query: string, unifiedResult: UnifiedSearchResponse) => {
    console.log('[🤖 AI] loadInsightAsync 시작');
    try {
      // 통계 정보 미리 계산
      const allResults = unifiedResult.results || [];
      const { ageData, regionData } = extractChartData(allResults);
      console.log('[🤖 AI] 통계 계산 완료:', { ageDataLength: ageData.length, regionDataLength: regionData.length });
      
      // 성별 분포 계산
      const genderCounts: Record<string, number> = {};
      allResults.forEach(row => {
        const gender = row.gender || '-';
        genderCounts[gender] = (genderCounts[gender] || 0) + 1;
      });
      const genderStats = Object.entries(genderCounts)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

      // LLM에 전달할 통계 정보 구성
      // 필터 키가 age 또는 age_range일 수 있으므로 둘 다 확인
      const filters = unifiedResult.parsed_query?.filters || {};
      const ageFilter = filters.age || filters.age_range;
      
      // extractedChips 구성: 필터 정보와 semantic_keywords 모두 포함
      const extractedChips: string[] = [];
      if (ageFilter) {
        extractedChips.push(String(ageFilter));
      }
      if (filters.gender) {
        extractedChips.push(String(filters.gender));
      }
      if (filters.region) {
        extractedChips.push(String(filters.region));
      }
      // 하이브리드 전략의 경우 semantic_keywords도 추가
      if (unifiedResult.parsed_query?.semantic_keywords) {
        extractedChips.push(...unifiedResult.parsed_query.semantic_keywords);
      }
      
      const panelSearchResult = {
        estimatedCount: unifiedResult.count || allResults.length,
        distributionStats: {
          gender: genderStats,
          age: ageData.map(d => ({ label: d.name, value: d.value })),
          region: regionData.map(d => ({ label: d.name, value: d.value }))
        },
        extractedChips: extractedChips
      };
      
      console.log('[🤖 AI] panelSearchResult 구성 완료:', {
        estimatedCount: panelSearchResult.estimatedCount,
        extractedChipsCount: panelSearchResult.extractedChips.length,
        hasDistributionStats: !!panelSearchResult.distributionStats
      });

      console.log('[🤖 AI] sqlSearch API 호출 시작...');
      const llmResponse = await sqlSearch(query, undefined, undefined, panelSearchResult);
      console.log('[🤖 AI] sqlSearch 응답 받음:', {
        hasPersona: !!llmResponse?.persona,
        hasWidgets: !!llmResponse?.widgets,
        widgetsCount: llmResponse?.widgets?.length || 0
      });
      
      const llmWidgets = llmResponse?.widgets || [];

      // LLM 결과 업데이트 (persona, widgets 포함)
      // ★ 중요: 기존 unifiedResult를 절대 잃어버리지 않도록 강제 보존
      console.log('[🤖 AI] searchResult 상태 업데이트 시작');
      
      setWidgets(llmWidgets);
      setSearchResult(prev => {
        // 디버깅: 현재 상태 체크
        console.log('[🤖 AI] 상태 업데이트 전 체크:', {
          hasPrev: !!prev,
          hasPrevUnified: !!prev?.unified,
          hasRefUnified: !!currentUnifiedResultRef.current,
          hasParamUnified: !!unifiedResult
        });
        // 안전장치 1: ref에서 최신 unifiedResult 가져오기
        const refUnified = currentUnifiedResultRef.current;
        // 안전장치 2: 함수 인자로 받은 unifiedResult
        const paramUnified = unifiedResult;
        
        // ★ 절대 사수: 기존 unifiedResult를 우선순위로 보존
        // 1순위: prev.unified (기존 상태)
        // 2순위: ref의 unifiedResult (handleSearch에서 저장한 것)
        // 3순위: 함수 인자 unifiedResult (최후의 수단)
        const currentUnified = prev?.unified || refUnified || paramUnified;
        
        if (!currentUnified) {
          console.error('[🤖 AI] ❌ CRITICAL: unifiedResult를 찾을 수 없습니다!');
          // 최후의 수단: 기존 상태 유지
          return prev || { unified: undefined, llm: llmResponse || undefined };
        }
        
        console.log('[🤖 AI] ✅ unifiedResult 보존 확인:', {
          hasCurrentUnified: !!currentUnified,
          unifiedCount: currentUnified?.count,
          unifiedResultsLength: currentUnified?.results?.length
        });
        
        // 기존 unifiedResult를 절대 잃어버리지 않고, llm만 추가/업데이트
        return {
          unified: currentUnified, // ★ 절대 사수!
          llm: llmResponse || undefined
        };
      });
      
      // 디버깅: persona 데이터 확인
      if (llmResponse?.persona) {
        console.log('[🤖 AI] ✅ Persona 데이터 생성 완료:', llmResponse.persona);
      } else {
        console.warn('[🤖 AI] ⚠️ Persona 데이터가 없습니다. LLM 응답:', llmResponse);
      }
      console.log('[🤖 AI] ✅ loadInsightAsync 완료');
    } catch (err) {
      console.error('[🤖 AI] ❌ LLM 요약 가져오기 실패:', err);
    } finally {
      console.log('[🤖 AI] setIsAnalyzing(false) - AI 분석 로딩 완료');
      setIsAnalyzing(false); // AI 분석 로딩 완료
    }
  };

  const handleDownloadExcel = async () => {
    if (!query || query.trim() === '') {
      alert('검색 쿼리가 없습니다. 검색 후 다운로드해주세요.');
      return;
    }

    try {
      // ★ Export API 사용: /api/panel/export 엔드포인트로 전체 데이터 다운로드
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const exportUrl = `${apiBaseUrl}/api/panel/export?q=${encodeURIComponent(query)}`;
      
      // 새 창에서 다운로드 시작
      window.location.href = exportUrl;
      
      console.log('[INFO] 패널 내보내기 시작:', exportUrl);
    } catch (error: any) {
      console.error('내보내기 실패:', error);
      alert('내보내기 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const handleRemoveFilter = (index: number) => {
    setActiveFilters(prev => prev.filter((_, i) => i !== index));
  };

  // 전체 결과 데이터 (통계 계산용) - state에서 가져오거나 fallback
  const currentAllResults = allResults.length > 0 ? allResults : (searchResult?.unified?.results || []);
  
  // 테이블 데이터 준비 (표시용, 최대 10개)
  const tableData = currentAllResults.slice(0, 10).map((r, idx) => ({
    id: r.respondent_id || r.doc_id || `#${idx + 1}`,
    gender: r.gender || '-',
    age: r.age_text || '-',
    region: r.region || '-',
    content: r.content ? (r.content.length > 50 ? r.content.substring(0, 50) + '...' : r.content) : '-'
  }));

  const tableColumns = [
    { key: 'id', label: 'ID' },
    { key: 'gender', label: '성별' },
    { key: 'age', label: '나이' },
    { key: 'region', label: '지역' },
    { key: 'content', label: '특이사항' },
  ];

  return {
    // State
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
    currentAllResults,
    tableData,
    tableColumns,
    
    // Actions
    handleSearch,
    handleDownloadExcel,
    handleRemoveFilter,
  };
};

