import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import { searchPanels } from '../../api/panel';
import { sqlSearch, semanticSearch, type LlmSqlResponse, type SemanticSearchResponse } from '../../api/llm';
import type { PanelSearchResult } from '../../types/panel';

const EXAMPLE_QUERIES = [
  "서울 20대 남자 100명",
  "30대 여성 중 수면부족인 사람들",
  "전국 직장인 중 스트레스 높은 그룹",
  "40대 이상 운동부족 패널",
  "서울/경기 지역 20-30대"
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  results?: PanelSearchResult;
  llm?: LlmSqlResponse;
  semanticSearch?: SemanticSearchResponse;
  isLoading?: boolean;
}

// 조건 카테고리 추출 헬퍼
const extractConditionCategory = (chips: string[]) => {
  const conditions: {
    region?: string;
    age?: string;
    gender?: string;
    count?: string;
    others?: string[];
  } = { others: [] };

  chips.forEach(chip => {
    if (chip.includes('서울') || chip.includes('경기') || chip.includes('부산') || chip.includes('대전') || chip.includes('인천') || chip.includes('지역')) {
      conditions.region = chip;
    } else if (chip.includes('대') || chip.includes('세') || /\d+대/.test(chip)) {
      conditions.age = chip;
    } else if (chip.includes('남') || chip.includes('여') || chip.includes('성별')) {
      conditions.gender = chip;
    } else if (chip.includes('명') || chip.includes('개') || /\d+명/.test(chip)) {
      conditions.count = chip;
    } else {
      conditions.others?.push(chip);
    }
  });

  return conditions;
};

// 간단한 막대 그래프 컴포넌트
const SimpleBarChart = ({ data, label, color }: { data: { label: string; value: number }[], label: string, color: string }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-gray-700 mb-3">{label}</div>
      {data.map((item, idx) => (
        <div key={idx} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">{item.label}</span>
            <span className="font-semibold text-gray-900">{item.value}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${color}`}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Semantic Search 결과 컴포넌트
const SemanticSearchResults = ({ semanticSearch }: { semanticSearch?: SemanticSearchResponse }) => {
  if (!semanticSearch) return null;

  return (
    <div className="mt-4 space-y-4 animate-fade-in">
      <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
        <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
          <i className="ri-search-line mr-2 text-purple-600"></i>
          의미 검색 결과
        </div>
        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed mb-4">
          {semanticSearch.summary}
        </div>
        <div className="text-xs text-gray-500 mb-2">
          검색된 문서: {semanticSearch.result_count}개
        </div>
        {semanticSearch.results && semanticSearch.results.length > 0 && (
          <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
            {semanticSearch.results.slice(0, 5).map((result, idx) => (
              <div key={idx} className="p-2 bg-white/50 rounded text-xs border border-purple-100">
                <div className="font-medium text-gray-700">ID: {result.id}</div>
                <div className="text-gray-600 mt-1 truncate">{result.content}</div>
                {result.similarity !== undefined && (
                  <div className="text-purple-600 mt-1">유사도: {(result.similarity * 100).toFixed(1)}%</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// 메시지 결과 컴포넌트
const MessageResults = ({ results, llm, query }: { results?: PanelSearchResult; llm?: LlmSqlResponse; query?: string }) => {
  if (!results) return null;

  const conditions = extractConditionCategory(results.extractedChips);
  const genderDistribution = results?.distributionStats?.gender || [];
  const ageDistribution = results?.distributionStats?.age || [];
  const totalPanelCount = results?.panelIds?.length || 0;

  const handleAddToFavorites = () => {
    if (!query) return;
    
    // localStorage에서 기존 즐겨찾기 불러오기
    const savedFavorites = localStorage.getItem('panel_favorites');
    let favorites: any[] = [];
    if (savedFavorites) {
      try {
        favorites = JSON.parse(savedFavorites);
      } catch (e) {
        console.error('즐겨찾기 파싱 오류:', e);
      }
    }
    
    // 이미 즐겨찾기에 있는지 확인
    const isAlreadyFavorite = favorites.some((fav: any) => fav.query === query);
    if (isAlreadyFavorite) {
      alert('이미 즐겨찾기에 추가된 검색어입니다.');
      return;
    }
    
    // chips 추출
    const chips = results.extractedChips || [];
    
    // 즐겨찾기 추가
    const newFavorite = {
      id: Date.now().toString(),
      query: query,
      chips: chips
    };
    
    favorites.push(newFavorite);
    localStorage.setItem('panel_favorites', JSON.stringify(favorites));
    alert('즐겨찾기에 추가되었습니다.');
  };

  const handleDownloadIds = () => {
    if (!results || !results.panelIds || results.panelIds.length === 0) return;
    const header = "panel_id (mb_sn)\n";
    const csvContent = "data:text/csv;charset=utf-8," + header + results.panelIds.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "panel_ids_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcel = () => {
    if (!results || !results.panelIds || results.panelIds.length === 0) return;
    const header = "panel_id (mb_sn)\n";
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + header + results.panelIds.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "panel_ids_export.xlsx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mt-4 space-y-4 animate-fade-in">
      {/* 즐겨찾기 추가 버튼 */}
      {query && (
        <div className="flex justify-end">
          <button
            onClick={handleAddToFavorites}
            className="px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-yellow-200"
            title="즐겨찾기에 추가"
          >
            <i className="ri-star-line"></i>
            즐겨찾기에 추가
          </button>
        </div>
      )}
      
      {/* 핵심 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
          <div className="text-xs text-gray-500 mb-1">전체 매칭</div>
          <div className="text-2xl font-bold text-blue-600">
            {(results.estimatedCount || 0).toLocaleString()}
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
          <div className="text-xs text-gray-500 mb-1">추출 완료</div>
          <div className="text-2xl font-bold text-green-600">
            {totalPanelCount.toLocaleString()}
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
          <div className="text-xs text-gray-500 mb-1">추출률</div>
          <div className="text-2xl font-bold text-purple-600">
            {results.estimatedCount > 0 ? ((totalPanelCount / results.estimatedCount * 100).toFixed(1)) : 0}%
          </div>
        </div>
      </div>

      {/* AI 해석 */}
      {llm && llm.answer && (
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
          <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
            <i className="ri-robot-line mr-2 text-purple-600"></i>
            AI 해석
          </div>
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {llm.answer}
            </div>
        </Card>
      )}

      {/* 추출된 조건 */}
      {conditions && (conditions.region || conditions.age || conditions.gender) && (
        <div className="flex flex-wrap gap-2">
          {conditions.region && (
            <Badge variant="info" className="text-xs">
              <i className="ri-map-pin-line mr-1"></i>
              {conditions.region}
            </Badge>
          )}
          {conditions.age && (
            <Badge variant="info" className="text-xs">
              <i className="ri-calendar-line mr-1"></i>
              {conditions.age}
            </Badge>
          )}
          {conditions.gender && (
            <Badge variant="info" className="text-xs">
              <i className="ri-user-line mr-1"></i>
              {conditions.gender}
            </Badge>
          )}
        </div>
      )}

      {/* 분포 통계 */}
      {(genderDistribution.length > 0 || ageDistribution.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {genderDistribution.length > 0 && (
            <Card className="p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">성별 분포</h4>
              {genderDistribution.length === 1 ? (
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-xl font-bold text-gray-900">
                    {genderDistribution[0].value.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    {genderDistribution[0].label === '남' ? '남성' : genderDistribution[0].label === '여' ? '여성' : genderDistribution[0].label}
                  </div>
                </div>
              ) : (
                <SimpleBarChart 
                  data={genderDistribution} 
                  label="성별"
                  color="bg-gradient-to-r from-pink-500 to-rose-500"
                />
              )}
            </Card>
          )}

          {ageDistribution.length > 0 && (
            <Card className="p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">연령대 분포</h4>
              {ageDistribution.length === 1 ? (
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-gray-900">
                    {ageDistribution[0].value.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    {ageDistribution[0].label}
                  </div>
                </div>
              ) : (
                <SimpleBarChart 
                  data={ageDistribution} 
                  label="연령대"
                  color="bg-gradient-to-r from-blue-500 to-cyan-500"
                />
              )}
            </Card>
          )}
          </div>
        )}
        
      {/* 다운로드 버튼 */}
      {totalPanelCount > 0 && (
        <div className="flex gap-2">
          <Button
            onClick={handleDownloadIds}
            variant="secondary"
            size="sm"
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
          >
            <i className="ri-file-text-line mr-2"></i>
            CSV 다운로드 ({totalPanelCount.toLocaleString()}개)
          </Button>
          <Button
            onClick={handleDownloadExcel}
            variant="secondary"
            size="sm"
            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white"
          >
            <i className="ri-file-excel-2-line mr-2"></i>
            Excel 다운로드
          </Button>
        </div>
      )}

      {/* 경고 메시지 */}
          {results.warnings && results.warnings.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          {results.warnings.map((warning, idx) => (
            <div key={idx} className="text-sm text-yellow-800 flex items-start gap-2">
              <i className="ri-alert-line mt-0.5"></i>
              <span>{warning}</span>
                  </div>
                ))}
              </div>
      )}
    </div>
  );
};

export default function QueryCanvas() {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [previousPanelIds, setPreviousPanelIds] = useState<string[] | null>(null);
  const [searchMode, setSearchMode] = useState<'panel' | 'semantic'>('panel');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const autoSearchExecuted = useRef(false);

  // 스크롤을 맨 아래로 이동
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // location state에서 initialQuery를 받아서 자동 검색
  useEffect(() => {
    const state = location.state as { initialQuery?: string; autoSearch?: boolean } | null;
    if (state?.initialQuery && state?.autoSearch && !autoSearchExecuted.current) {
      setQuery(state.initialQuery);
      autoSearchExecuted.current = true;
      // 약간의 지연 후 자동 검색 실행
      setTimeout(() => {
        handleQuerySubmit(state.initialQuery!);
      }, 100);
    }
  }, [location.state]);

  const handleQuerySubmit = async (queryText?: string) => {
    const queryToUse = queryText || query;
    if (!queryToUse.trim() || isLoading) return;
    
    // queryText가 제공된 경우 query state도 업데이트
    if (queryText) {
      setQuery(queryText);
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: queryToUse.trim(),
      timestamp: new Date(),
    };

    // 사용자 메시지 추가
    setMessages(prev => [...prev, userMessage]);

    // 로딩 중인 어시스턴트 메시지 추가
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };
    setMessages(prev => [...prev, assistantMessage]);

    setIsLoading(true);
    setError(null);
    const currentQuery = queryToUse.trim();
    if (!queryText) {
      setQuery('');
    }

    // 이전 메시지에서 가장 최근 추출 결과 찾기
    const previousMessageWithResults = [...messages]
      .reverse()
      .find(m => m.role === 'assistant' && m.results && m.results.panelIds && m.results.panelIds.length > 0);
    
    const previousExtractedPanelIds = previousMessageWithResults?.results?.panelIds || previousPanelIds;
    
    // 후속 질의인지 확인: 키워드 기반 + 이전 추출 결과가 있는지 확인
    const hasFollowUpKeywords = /그\s*(중에|중|들\s*중|들)|이\s*중에|위\s*에서|앞서|이전|먼저|그\s*들|이\s*들/i.test(currentQuery);
    const isFollowUpQuery = hasFollowUpKeywords && previousExtractedPanelIds && previousExtractedPanelIds.length > 0;
    
    try {
      // Semantic Search 모드인 경우
      if (searchMode === 'semantic') {
        const semanticResult = await semanticSearch(currentQuery).catch((err) => {
          console.error('의미 검색 오류:', err);
          const errorMessage = err?.response?.data?.error || err?.message || '의미 검색 중 오류가 발생했습니다.';
          setError(errorMessage);
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? {
                  ...msg,
                  content: `오류: ${errorMessage}`,
                  isLoading: false,
                }
              : msg
          ));
          setIsLoading(false);
          return null;
        });
        
        if (semanticResult) {
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? {
                  ...msg,
                  content: semanticResult.summary || '의미 검색이 완료되었습니다.',
                  semanticSearch: semanticResult,
                  isLoading: false,
                }
              : msg
          ));
        } else if (semanticResult === null) {
          // 이미 오류 처리됨
          return;
        } else {
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? {
                  ...msg,
                  content: '의미 검색 중 오류가 발생했습니다.',
                  isLoading: false,
                }
              : msg
          ));
        }
        setIsLoading(false);
        return;
      }

      // 대화 히스토리 구성 (이전 메시지들)
      const conversationHistory = messages
        .filter(m => m.role === 'user' || (m.role === 'assistant' && m.llm))
        .map(m => ({
          role: m.role,
          content: m.role === 'user' ? m.content : (m.llm?.answer || m.content)
        }));

      // 먼저 패널 검색을 실행 (후속 질의면 이전 추출 결과를 기반으로)
      const apiResponse = await searchPanels(
        currentQuery, 
        isFollowUpQuery ? previousExtractedPanelIds : undefined
      ).catch((err) => {
        console.error('패널 검색 오류:', err);
        return null;
      });
      
      if (apiResponse) {
        const validatedResponse: PanelSearchResult = {
          extractedChips: Array.isArray(apiResponse.extractedChips) ? apiResponse.extractedChips : [],
          previewData: Array.isArray(apiResponse.previewData) ? apiResponse.previewData : [],
          estimatedCount: typeof apiResponse.estimatedCount === 'number' ? apiResponse.estimatedCount : 0,
          panelIds: Array.isArray(apiResponse.panelIds) ? apiResponse.panelIds : [],
          warnings: Array.isArray(apiResponse.warnings) ? apiResponse.warnings : [],
          samplePanels: Array.isArray(apiResponse.samplePanels) ? apiResponse.samplePanels : [],
          distributionStats: apiResponse.distributionStats || { gender: [], age: [], region: [] },
          sqlQuery: apiResponse.sqlQuery || '',
        };
        
        // previousPanelIds 업데이트: 후속 질의가 아니고 결과가 있으면 업데이트
        // 후속 질의일 때는 이전 결과를 유지 (새로운 결과로 덮어쓰지 않음)
        if (!isFollowUpQuery && validatedResponse.panelIds.length > 0) {
          setPreviousPanelIds(validatedResponse.panelIds);
        } else if (!isFollowUpQuery) {
          // 후속 질의가 아니고 결과도 없으면 null로 설정
          setPreviousPanelIds(null);
        }
        // 후속 질의일 때는 previousPanelIds를 업데이트하지 않음 (이전 결과 유지)
        
        // 패널 검색 결과를 LLM에 전달
        const llmResponse = await sqlSearch(
          currentQuery, 
          undefined, 
          conversationHistory,
          {
            estimatedCount: validatedResponse.estimatedCount,
            distributionStats: validatedResponse.distributionStats,
            extractedChips: validatedResponse.extractedChips,
            previousPanelIds: isFollowUpQuery && previousExtractedPanelIds ? previousExtractedPanelIds : undefined,
          }
        ).catch((err) => {
          console.error('LLM SQL 검색 오류:', err);
          return null;
        });
        
        // 어시스턴트 메시지 업데이트
        // 메시지 버블에는 간단한 메시지만 표시하고, 상세한 AI 해석은 MessageResults에서만 표시
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? {
                ...msg,
                content: '패널 검색이 완료되었습니다.',
                results: validatedResponse,
                llm: llmResponse || undefined,
                isLoading: false,
              }
            : msg
        ));

        // 결과를 로컬 스토리지에 저장 (panelIds는 제외하여 용량 절약)
        // panelIds가 너무 크면 localStorage 용량 초과 오류 발생
        const reportEntry = {
          id: Date.now().toString(),
          query: currentQuery,
          timestamp: new Date().toISOString(),
          results: {
            ...validatedResponse,
            // panelIds는 샘플만 저장 (최대 100개) 또는 저장하지 않음
            panelIds: validatedResponse.panelIds.slice(0, 100), // 샘플만 저장
            panelIdsCount: validatedResponse.panelIds.length, // 전체 개수는 별도로 저장
          },
          llm: llmResponse
        };
        
        try {
          const existingHistory = localStorage.getItem('panel_extraction_history');
          let history: typeof reportEntry[] = [];
          if (existingHistory) {
            try {
              history = JSON.parse(existingHistory);
            } catch (e) {
              console.error('Failed to parse history:', e);
            }
          }
          
          history.unshift(reportEntry);
          history = history.slice(0, 20); // 최대 20개로 제한하여 용량 절약
          
          // localStorage 저장 시도 (용량 초과 시 오래된 항목 제거)
          try {
            localStorage.setItem('panel_extraction_history', JSON.stringify(history));
          } catch (storageError: any) {
            // 용량 초과 시 오래된 항목 제거 후 재시도
            if (storageError.name === 'QuotaExceededError' || storageError.message?.includes('quota')) {
              console.warn('localStorage 용량 초과, 오래된 항목 제거 중...');
              // 더 적은 수로 제한
              history = history.slice(0, 10);
              localStorage.setItem('panel_extraction_history', JSON.stringify(history));
            } else {
              throw storageError;
            }
          }
          
          // 최신 결과는 panelIds 없이 저장 (용량 절약)
          const resultsWithoutPanelIds = {
            ...validatedResponse,
            panelIds: [], // panelIds는 저장하지 않음
            panelIdsCount: validatedResponse.panelIds.length,
          };
          
          try {
            localStorage.setItem('panel_extraction_results', JSON.stringify(resultsWithoutPanelIds));
          } catch (storageError: any) {
            // 용량 초과 시 무시 (필수 데이터가 아님)
            console.warn('panel_extraction_results 저장 실패:', storageError);
          }
          
          if (llmResponse) {
            try {
              localStorage.setItem('panel_llm_response', JSON.stringify(llmResponse));
            } catch (storageError: any) {
              console.warn('panel_llm_response 저장 실패:', storageError);
            }
          }
        } catch (err: any) {
          console.error('localStorage 저장 오류:', err);
          // localStorage 오류는 치명적이지 않으므로 계속 진행
        }
      } else {
        setError('패널 검색 결과를 가져오지 못했습니다.');
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? {
                ...msg,
                content: '패널 검색 중 오류가 발생했습니다.',
                isLoading: false,
              }
            : msg
        ));
      }
    } catch (err: any) {
      console.error('질의 처리 오류:', err);
      setError(err?.message || '질의 처리 중 오류가 발생했습니다.');
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? {
              ...msg,
              content: '오류가 발생했습니다: ' + (err?.message || '알 수 없는 오류'),
              isLoading: false,
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* 헤더 */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] bg-clip-text text-transparent">
              패널 질의 챗봇
            </h1>
            <p className="text-gray-600 mt-0.5 text-xs">자연어로 패널을 검색하고 대화하세요</p>
          </div>
          {messages.length === 0 && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#2F6BFF]/10 to-[#8B5CF6]/10 backdrop-blur-sm rounded-full shadow-sm border border-[#2F6BFF]/20">
              <div className="w-2 h-2 bg-[#2F6BFF] rounded-full animate-pulse"></div>
              <span className="text-xs text-[#2F6BFF] font-medium">AI 준비됨</span>
            </div>
          )}
        </div>
      </div>

      {/* 채팅 영역 */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="max-w-4xl mx-auto mt-2 animate-fade-in">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[#2F6BFF] to-[#8B5CF6] rounded-full flex items-center justify-center mx-auto mb-2">
                <i className="ri-robot-line text-2xl text-white"></i>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">패널 검색 챗봇에 오신 것을 환영합니다</h2>
              <p className="text-gray-600 mb-3 text-xs">자연어로 패널을 검색하고, 대화를 이어가며 더 세밀한 조건으로 필터링할 수 있습니다.</p>
            </div>
            
            <div>
              <h3 className="text-xs font-medium text-gray-700 mb-2 flex items-center justify-center">
                <i className="ri-lightbulb-line mr-1.5 text-yellow-500"></i>
                빠른 시작 - 예시 질문
              </h3>
              <div className="flex flex-wrap gap-2 justify-center">
                {EXAMPLE_QUERIES.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(example)}
                    className="px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full text-xs text-gray-700 hover:bg-gradient-to-r hover:from-[#2F6BFF]/10 hover:to-[#8B5CF6]/10 hover:border-[#2F6BFF] hover:text-[#2F6BFF] transition-all duration-300 hover:shadow-md hover:scale-105"
                  >
                    <i className="ri-search-line mr-1"></i>
                    {example}
                  </button>
                ))}
              </div>
                    </div>
                  </div>
        )}

        {/* 메시지 리스트 */}
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* 아바타 */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-gradient-to-br from-[#2F6BFF] to-[#8B5CF6]' 
                    : 'bg-gradient-to-br from-gray-100 to-gray-200'
                }`}>
                  {message.role === 'user' ? (
                    <i className="ri-user-line text-white text-lg"></i>
                  ) : (
                    <i className="ri-robot-line text-gray-600 text-lg"></i>
                  )}
              </div>

                {/* 메시지 내용 */}
                <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] text-white'
                      : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                  }`}>
                    {message.isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        <span className="text-sm ml-2">검색 중...</span>
                      </div>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {message.content || '응답을 생성하는 중...'}
                      </div>
                    )}
                  </div>
                  
                  {/* 결과 표시 */}
                  {!message.isLoading && message.role === 'assistant' && (
                    <>
                      <MessageResults 
                        results={message.results} 
                        llm={message.llm} 
                        query={messages.find(m => m.role === 'user' && m.id < message.id)?.content || query} 
                      />
                      <SemanticSearchResults semanticSearch={message.semanticSearch} />
                    </>
                  )}

                  {/* 타임스탬프 */}
                  <div className="text-xs text-gray-400 mt-1 px-1">
                    {message.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <i className="ri-error-warning-line mr-2"></i>
              {error}
            </div>
          )}
          
          {/* 검색 모드 전환 버튼 */}
          <div className="mb-3 flex gap-2 justify-center">
            <button
              onClick={() => setSearchMode('panel')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                searchMode === 'panel'
                  ? 'bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <i className="ri-database-2-line mr-2"></i>
              패널 검색
            </button>
            <button
              onClick={() => setSearchMode('semantic')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                searchMode === 'semantic'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <i className="ri-search-line mr-2"></i>
              의미 검색
            </button>
          </div>
          
          <div className="relative">
            <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-2xl p-1 shadow-lg border border-gray-200">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchMode === 'semantic' ? "의미 검색 질문을 입력하세요... (예: 운동을 좋아하는 사람들의 특징)" : "패널 검색 조건을 입력하세요... (예: 서울 20대 남자 100명)"}
                className="w-full min-h-[60px] max-h-[200px] p-4 bg-white border-0 rounded-xl resize-none focus:ring-2 focus:ring-[#2F6BFF]/20 focus:outline-none text-gray-800 placeholder-gray-400 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleQuerySubmit();
                  }
                }}
                disabled={isLoading}
                rows={1}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <div className="text-xs text-gray-400 bg-white/80 px-2 py-1 rounded-md backdrop-blur-sm">
                  Enter로 전송
                </div>
                <Button 
                  onClick={() => handleQuerySubmit()} 
                  disabled={isLoading || !query.trim()}
                  className="shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] text-white border-0"
                  size="sm"
                >
                  {isLoading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      처리 중...
                    </>
                  ) : (
                    <>
                      <i className="ri-send-plane-line mr-2"></i>
                      전송
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
              </div>
    </div>
  );
}
