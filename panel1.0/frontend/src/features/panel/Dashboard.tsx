import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDashboardData } from '../../api/panel';
import type { RecentQuery } from '../../types/panel';

// 즐겨찾기 데이터 타입
interface FavoriteQuery {
  id: string;
  query: string;
  chips: string[];
}

// 패널 데이터 요약 타입
interface PanelSummary {
  totalPanels: number;
  genderDistribution: { name: string; value: number; color: string }[];
  ageDistribution: { age: string; count: number }[];
  regionDistribution: { name: string; value: number; color: string }[];
}


export default function PanelDashboard() {
  const navigate = useNavigate();
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([]);
  const [favorites, setFavorites] = useState<FavoriteQuery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 패널 데이터 요약
  const [panelSummary, setPanelSummary] = useState<PanelSummary>({
    totalPanels: 0,
    genderDistribution: [],
    ageDistribution: [],
    regionDistribution: []
  });


  // 추천 질의 (임시 데이터)
  const [recommendedQueries] = useState<string[]>([
    '서울 20대 여성 100명',
    '30대 직장인 중 스트레스 높은 그룹',
    '경기 지역 40대 이상 운동부족 패널',
    '전국 대학생 중 수면부족인 사람들'
  ]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getDashboardData();
        
        // 백엔드에서 패널 통계 데이터 가져오기
        if ((data as any).panelSummary) {
          const summary = (data as any).panelSummary;
          setPanelSummary({
            totalPanels: summary.totalPanels || 0,
            genderDistribution: summary.genderDistribution || [],
            ageDistribution: summary.ageDistribution || [],
            regionDistribution: summary.regionDistribution || []
          });
        }
        
        // localStorage에서 최근 질의 불러오기
        const historyStr = localStorage.getItem('panel_extraction_history');
        if (historyStr) {
          try {
            const history = JSON.parse(historyStr);
            // 최근 질의 형식으로 변환
            const recentQueriesData: RecentQuery[] = history.slice(0, 10).map((entry: any) => {
              // chips 추출 (검색 결과에서 extractedChips 또는 previewData 활용)
              const chips: string[] = [];
              if (entry.results?.extractedChips && Array.isArray(entry.results.extractedChips)) {
                chips.push(...entry.results.extractedChips);
              } else if (entry.results?.previewData && Array.isArray(entry.results.previewData)) {
                // previewData에서 chips 생성
                entry.results.previewData.forEach((preview: any) => {
                  if (preview.columnHuman && preview.value) {
                    chips.push(`${preview.columnHuman}: ${preview.value}`);
                  }
                });
              }
              
              // chips가 없으면 기본값
              if (chips.length === 0) {
                chips.push('검색 결과');
              }
              
              // 시간 포맷팅
              const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date(parseInt(entry.id));
              const now = new Date();
              const diffMs = now.getTime() - timestamp.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              const diffHours = Math.floor(diffMs / 3600000);
              const diffDays = Math.floor(diffMs / 86400000);
              
              let timeStr = '';
              if (diffMins < 1) timeStr = '방금 전';
              else if (diffMins < 60) timeStr = `${diffMins}분 전`;
              else if (diffHours < 24) timeStr = `${diffHours}시간 전`;
              else if (diffDays < 7) timeStr = `${diffDays}일 전`;
              else timeStr = timestamp.toLocaleDateString('ko-KR');
              
              return {
                id: parseInt(entry.id) || Date.now(),
                query: entry.query || '',
                chips: chips.length > 0 ? chips : ['검색 결과'],
                time: timeStr,
                executor: '사용자', // 기본값
                resultCount: entry.results?.panelIdsCount || entry.results?.panelIds?.length || 0
              };
            });
            setRecentQueries(recentQueriesData);
          } catch (e) {
            console.error('최근 질의 파싱 오류:', e);
            setRecentQueries([]);
          }
        } else {
          setRecentQueries([]);
        }
        
        // localStorage에서 즐겨찾기 불러오기
        const savedFavorites = localStorage.getItem('panel_favorites');
        if (savedFavorites) {
          try {
            setFavorites(JSON.parse(savedFavorites));
          } catch (e) {
            console.error('즐겨찾기 파싱 오류:', e);
            setFavorites([]);
          }
        } else {
          setFavorites([]);
        }
      } catch (err: any) {
        setError(err.message || '데이터를 불러오는 데 실패했습니다.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleRerunQuery = (query: string) => {
    // 질의 페이지로 이동하고 쿼리 전달 (자동 검색을 위해 URL 파라미터도 추가)
    navigate('/?tab=panel&menu=query', { 
      state: { initialQuery: query, autoSearch: true } 
    });
  };

  const handleRecommendedClick = (query: string) => {
    handleRerunQuery(query);
  };

  const handleAddFavorite = () => {
    // 즐겨찾기 추가 다이얼로그 또는 입력창
    const query = prompt('즐겨찾기에 추가할 검색어를 입력하세요:');
    if (query && query.trim()) {
      const newFavorite: FavoriteQuery = {
        id: Date.now().toString(),
        query: query.trim(),
        chips: [] // 사용자가 직접 입력한 경우 chips는 비움
      };
      
      const updatedFavorites = [...favorites, newFavorite];
      setFavorites(updatedFavorites);
      localStorage.setItem('panel_favorites', JSON.stringify(updatedFavorites));
    }
  };

  const handleRemoveFavorite = (e: React.MouseEvent, favoriteId: string) => {
    e.stopPropagation(); // 부모 버튼 클릭 이벤트 방지
    const favorite = favorites.find(fav => fav.id === favoriteId);
    if (favorite && window.confirm(`"${favorite.query}" 즐겨찾기를 삭제하시겠습니까?`)) {
      const updatedFavorites = favorites.filter(fav => fav.id !== favoriteId);
      setFavorites(updatedFavorites);
      localStorage.setItem('panel_favorites', JSON.stringify(updatedFavorites));
    }
  };

  const handleAddFavoriteFromQuery = (e: React.MouseEvent, query: string, chips: string[]) => {
    e.stopPropagation(); // 부모 버튼 클릭 이벤트 방지
    
    // 이미 즐겨찾기에 있는지 확인
    const isAlreadyFavorite = favorites.some(fav => fav.query === query);
    if (isAlreadyFavorite) {
      alert('이미 즐겨찾기에 추가된 검색어입니다.');
      return;
    }
    
    const newFavorite: FavoriteQuery = {
      id: Date.now().toString(),
      query: query,
      chips: chips
    };
    
    const updatedFavorites = [...favorites, newFavorite];
    setFavorites(updatedFavorites);
    localStorage.setItem('panel_favorites', JSON.stringify(updatedFavorites));
    alert('즐겨찾기에 추가되었습니다.');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#2F6BFF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center p-6 bg-white rounded-2xl shadow-lg">
          <i className="ri-error-warning-line text-4xl text-red-500 mb-4"></i>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] bg-clip-text text-transparent mb-2">
            패널 대시보드
          </h1>
          <p className="text-gray-600">자연어 기반 패널 검색 시스템</p>
        </div>

        {/* 패널 데이터 요약 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 총 패널 수 카드 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">전체 패널 수</h3>
              <div className="w-12 h-12 bg-gradient-to-br from-[#2F6BFF] to-[#8B5CF6] rounded-xl flex items-center justify-center">
                <i className="ri-user-line text-white text-xl"></i>
              </div>
            </div>
            <div className="text-4xl font-bold text-gray-900 mb-2">
              {panelSummary.totalPanels.toLocaleString()}
            </div>
            <p className="text-sm text-gray-500">등록된 전체 패널</p>
          </div>

          {/* 성별 비율 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">성별 분포</h3>
            {panelSummary.genderDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={panelSummary.genderDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {panelSummary.genderDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400">
                <p>데이터가 없습니다</p>
              </div>
            )}
          </div>

          {/* 지역별 비율 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">지역별 분포</h3>
            {panelSummary.regionDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={panelSummary.regionDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {panelSummary.regionDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400">
                <p>데이터가 없습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* 연령대 분포 차트 */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">연령대 분포</h3>
          {panelSummary.ageDistribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={panelSummary.ageDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="age" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Bar dataKey="count" fill="url(#colorGradient)" radius={[8, 8, 0, 0]}>
                    {panelSummary.ageDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#2F6BFF' : '#8B5CF6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2F6BFF" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <p>데이터가 없습니다</p>
            </div>
          )}
        </div>

        {/* 최근 질의 & 즐겨찾기 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 최근 질의 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <i className="ri-history-line text-[#2F6BFF]"></i>
                최근 질의
              </h3>
              <span className="text-sm text-gray-500">{recentQueries.length}개</span>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {recentQueries.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <i className="ri-inbox-line text-4xl mb-2"></i>
                  <p>최근 질의가 없습니다</p>
                </div>
              ) : (
                recentQueries.map((query) => (
                  <div
                    key={query.id}
                    className="p-4 rounded-xl border border-gray-100 hover:border-[#2F6BFF] hover:shadow-md transition-all bg-gradient-to-r from-white to-gray-50 relative group"
                  >
                    <p className="text-sm font-medium text-gray-900 mb-2 pr-8">{query.query}</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {query.chips.slice(0, 3).map((chip, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-[#2F6BFF]/10 text-[#2F6BFF] rounded-full text-xs font-medium"
                        >
                          {chip}
                        </span>
                      ))}
                      {query.chips.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                          +{query.chips.length - 3}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{query.time} | {query.resultCount.toLocaleString()}명</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleAddFavoriteFromQuery(e, query.query, query.chips)}
                          className="p-1.5 text-gray-400 hover:text-yellow-500 transition-colors"
                          title="즐겨찾기에 추가"
                        >
                          <i className="ri-star-line text-lg"></i>
                        </button>
                        <button
                          onClick={() => handleRerunQuery(query.query)}
                          className="px-4 py-1.5 bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] text-white text-xs font-medium rounded-lg hover:shadow-lg transition-all"
                        >
                          <i className="ri-search-line mr-1"></i>
                          다시 검색
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 즐겨찾기 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <i className="ri-star-line text-yellow-500"></i>
                즐겨찾기
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{favorites.length}개</span>
                <button
                  onClick={handleAddFavorite}
                  className="px-3 py-1.5 bg-[#2F6BFF] text-white text-xs font-medium rounded-lg hover:bg-[#2563EB] transition-colors flex items-center gap-1"
                >
                  <i className="ri-add-line"></i>
                  추가
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {favorites.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <i className="ri-star-line text-4xl mb-2"></i>
                  <p>저장된 즐겨찾기가 없습니다</p>
                  <p className="text-xs mt-1">검색 결과에서 즐겨찾기를 추가하세요</p>
                </div>
              ) : (
                favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="w-full p-4 rounded-xl border border-gray-100 hover:border-[#2F6BFF] hover:shadow-md transition-all bg-gradient-to-r from-white to-yellow-50 group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-[#2F6BFF] transition-colors flex-1">
                        {fav.query}
                      </p>
                      <button
                        onClick={(e) => handleRemoveFavorite(e, fav.id)}
                        className="p-1.5 text-yellow-500 hover:text-red-500 transition-colors flex-shrink-0"
                        title="즐겨찾기 삭제"
                      >
                        <i className="ri-star-fill text-lg"></i>
                      </button>
                    </div>
                    {fav.chips.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {fav.chips.map((chip, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-[#2F6BFF]/10 text-[#2F6BFF] rounded-full text-xs font-medium"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => handleRerunQuery(fav.query)}
                      className="w-full px-4 py-2 bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] text-white text-xs font-medium rounded-lg hover:shadow-lg transition-all"
                    >
                      <i className="ri-search-line mr-1"></i>
                      검색
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 개인화 추천 질의 */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <i className="ri-lightbulb-line text-yellow-500"></i>
              추천 질의
            </h3>
            <span className="text-xs text-gray-500">최근 검색 기반 추천</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {recommendedQueries.map((query, idx) => (
              <button
                key={idx}
                onClick={() => handleRecommendedClick(query)}
                className="px-4 py-2.5 bg-gradient-to-r from-[#2F6BFF]/10 to-[#8B5CF6]/10 hover:from-[#2F6BFF] hover:to-[#8B5CF6] text-[#2F6BFF] hover:text-white rounded-xl text-sm font-medium transition-all border border-[#2F6BFF]/20 hover:border-transparent hover:shadow-lg"
              >
                <i className="ri-search-line mr-2"></i>
                {query}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
