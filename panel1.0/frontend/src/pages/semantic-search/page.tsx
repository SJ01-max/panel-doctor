import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Brain, TrendingUp, Award, Users, Filter, Download, BarChart3, Target, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, CartesianGrid, LabelList } from 'recharts';
import { semanticSearch, type SemanticSearchResponse } from '../../api/semantic-search';
import Card from '../../components/base/Card';

// ShadCN 스타일 Card 컴포넌트 (기존 Card를 확장)
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}> = ({ title, value, subtitle, icon, className = '' }) => (
  <Card className={`p-6 ${className}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="text-sm font-medium text-gray-500">{title}</div>
      {icon && <div className="text-gray-400">{icon}</div>}
    </div>
    <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
    {subtitle && <div className="text-xs text-gray-400">{subtitle}</div>}
  </Card>
);

// Panel Card 컴포넌트
const PanelCard: React.FC<{
  panel: SemanticSearchResponse['panels'][0];
  onViewDetail: (respondentId: string) => void;
}> = ({ panel, onViewDetail }) => {
  const score = panel.score || 0;
  const scoreColor = 
    score >= 90 ? 'bg-green-500' :
    score >= 80 ? 'bg-blue-500' :
    score >= 70 ? 'bg-violet-500' :
    'bg-gray-400';
  
  const genderText = panel.gender === 'M' || panel.gender === '남' ? '남성' : 
                     panel.gender === 'F' || panel.gender === '여' ? '여성' : panel.gender;
  
  return (
    <Card className="p-5 hover:shadow-lg transition-all cursor-pointer group">
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center text-2xl flex-shrink-0">
          {panel.gender === 'M' || panel.gender === '남' ? '👨' : '👩'}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-900 truncate">
              {panel.respondent_id}
            </div>
            <div className={`px-3 py-1 rounded-full text-white text-lg font-bold ${scoreColor} flex-shrink-0 ml-2`}>
              {score}%
            </div>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <div>{genderText} · {panel.age_text || `${panel.age}세`}</div>
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              {panel.region}
            </div>
          </div>
        </div>
      </div>
      
      {/* Tags */}
      {panel.tags && panel.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {panel.tags.slice(0, 3).map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-1 bg-violet-50 text-violet-700 rounded text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      
      {/* View Detail Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onViewDetail(panel.respondent_id);
        }}
        className="w-full px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-sm font-medium transition-colors group-hover:bg-violet-100"
      >
        상세 보기
      </button>
    </Card>
  );
};

export default function SemanticSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SemanticSearchResponse | null>(null);
  const [scoreThreshold, setScoreThreshold] = useState(70);
  const [displayCount, setDisplayCount] = useState(50);
  
  // 검색 실행
  const handleSearch = async (searchQuery?: string) => {
    const queryToUse = searchQuery || query;
    if (!queryToUse.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setQuery(queryToUse);
    setSearchParams({ q: queryToUse });
    
    try {
      const result = await semanticSearch(queryToUse);
      setData(result);
    } catch (err: any) {
      setError(err?.message || '검색 중 오류가 발생했습니다.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  // URL 파라미터에서 초기 검색
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && q !== query) {
      setQuery(q);
      handleSearch(q);
    }
  }, []);
  
  // 필터링된 패널 목록
  const filteredPanels = useMemo(() => {
    if (!data) return [];
    return data.panels
      .filter(panel => panel.score >= scoreThreshold)
      .slice(0, displayCount);
  }, [data, scoreThreshold, displayCount]);
  
  // 히스토그램 데이터 (3개 구간) - 이미지와 동일하게 70-80, 80-90, 90-100 형식으로
  const histogramData = useMemo(() => {
    if (!data) return [];
    
    const bins = {
      '90-100': 0,
      '80-90': 0,
      '70-80': 0
    };
    
    data.panels.forEach(panel => {
      const score = panel.score;
      if (score >= 90) bins['90-100']++;
      else if (score >= 80) bins['80-90']++;
      else if (score >= 70) bins['70-80']++;
    });
    
    return Object.entries(bins)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .reverse(); // 높은 점수부터
  }, [data]);
  
  // Scatter Chart 데이터
  const scatterData = useMemo(() => {
    if (!data) return [];
    return data.panels
      .map(panel => ({
        age: panel.age,
        score: panel.score,
        region: panel.region,
        id: panel.respondent_id
      }))
      .slice(0, 100); // 최대 100개
  }, [data]);
  
  // 패널 상세 보기
  const handleViewDetail = (respondentId: string) => {
    navigate(`/panel/${respondentId}`);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 검색바 */}
        <div className="mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="의미 기반 검색 (예: 우울한 사람, 스트레스 높은 그룹)"
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => handleSearch()}
                disabled={isLoading}
                className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '검색 중...' : '검색'}
              </button>
            </div>
          </Card>
        </div>
        
        {/* 로딩 상태 */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
            <p className="mt-4 text-gray-600">AI가 검색 결과를 분석 중입니다...</p>
          </div>
        )}
        
        {/* 에러 상태 */}
        {error && (
          <Card className="p-6 bg-red-50 border-red-200">
            <p className="text-red-600">{error}</p>
          </Card>
        )}
        
        {/* 결과 영역 */}
        {!isLoading && !error && data && (
          <>
            {/* ① AI 요약 섹션 */}
            <Card className="p-6 mb-6 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 text-white border-0">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-6 h-6 flex-shrink-0" />
                  <Star className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-4">AI 인사이트 요약</h2>
                  <div className="bg-white/95 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">전체 패널 중 높은 유사도</div>
                      <div className="text-2xl font-bold text-violet-600">{Math.round((data.panels.filter(p => p.score >= 70).length / data.panels.length) * 100)}%</div>
                      <div className="text-xs text-gray-600 mt-1">검색 의도와 높은 유사도</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">주요 타겟 그룹</div>
                      <div className="text-lg font-bold text-indigo-600">
                        {(() => {
                          const ageGroups: Record<string, number> = {};
                          data.panels.forEach(p => {
                            const decade = Math.floor(p.age / 10) * 10;
                            const key = `${decade}대`;
                            ageGroups[key] = (ageGroups[key] || 0) + 1;
                          });
                          const mainAge = Object.entries(ageGroups).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
                          return mainAge;
                        })()}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {(() => {
                          const regions: Record<string, number> = {};
                          data.panels.forEach(p => {
                            const mainRegion = p.region.split(/\s+/)[0];
                            regions[mainRegion] = (regions[mainRegion] || 0) + 1;
                          });
                          const mainRegion = Object.entries(regions).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
                          return mainRegion;
                        })()} 지역
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">평균 Match Score</div>
                      <div className="text-2xl font-bold text-blue-600">{data.stats.avg}%</div>
                      <div className="text-xs text-gray-600 mt-1">/ 5.0 기준</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">연관 키워드</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {data.keywords.slice(0, 3).map((kw, idx) => (
                          <span key={idx} className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-medium">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            
            {/* ② 핵심 지표 카드 4개 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="평균 Match Score"
                value={`${data.stats.avg}%`}
                icon={<TrendingUp className="w-5 h-5" />}
                className="border-l-4 border-l-violet-500"
              />
              <StatCard
                title="최고 Score"
                value={`${data.stats.max}%`}
                icon={<Award className="w-5 h-5" />}
                className="border-l-4 border-l-green-500"
              />
              <StatCard
                title="상위 10% 평균"
                value={`${data.stats.top10_avg}%`}
                icon={<BarChart3 className="w-5 h-5" />}
                className="border-l-4 border-l-blue-500"
              />
              <StatCard
                title="조건 부합 패널"
                value={`${data.stats.count}명`}
                icon={<Users className="w-5 h-5" />}
                className="border-l-4 border-l-indigo-500"
              />
            </div>
            
            {/* ③ 패널 Top 리스트 - 카드 UI */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">추천 패널</h3>
                <span className="text-sm text-gray-500">
                  {filteredPanels.length}개 표시 중
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPanels.map((panel) => (
                  <PanelCard
                    key={panel.respondent_id}
                    panel={panel}
                    onViewDetail={handleViewDetail}
                  />
                ))}
              </div>
            </div>
            
            {/* ④ 고도화된 시각화 2개 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* (A) Score Distribution 히스토그램 */}
              <Card className="p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-violet-600" />
                  Match Score 분석
                </h4>
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-3">Score 히스토그램</h5>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={histogramData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {histogramData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.name === '90-100' ? '#10b981' :
                              entry.name === '80-90' ? '#6366f1' :
                              '#8b5cf6'
                            }
                          />
                        ))}
                        <LabelList 
                          dataKey="value" 
                          position="top" 
                          formatter={(value: number) => `${value}개`}
                          style={{ fill: '#374151', fontSize: '12px', fontWeight: 'bold' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-6">
                  <h5 className="text-sm font-medium text-gray-700 mb-3">지역별 Score (Top 5)</h5>
                  <div className="text-sm text-gray-500 text-center py-8">
                    데이터 준비 중...
                  </div>
                </div>
              </Card>
              
              {/* (B) 연령별 Score 상관 그래프 */}
              <Card className="p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-600" />
                  연령별 Score 상관 분석
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={scatterData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="age" 
                      name="나이" 
                      type="number" 
                      domain={[0, 100]}
                      label={{ value: '나이', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      dataKey="score" 
                      name="Score" 
                      type="number" 
                      domain={[0, 100]}
                      label={{ value: 'Match Score', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload[0]) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                              <div className="font-semibold">{data.age}세 / Score {data.score}%</div>
                              <div className="text-xs text-gray-600 mt-1">지역: {data.region}</div>
                              <div className="text-xs text-gray-600">ID: {data.id}</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter dataKey="score" fill="#7c3aed" />
                  </ScatterChart>
                </ResponsiveContainer>
              </Card>
            </div>
            
            {/* ⑤ 필터 옵션 (하단 고정) */}
            <Card className="p-6 sticky bottom-0 z-10 bg-white shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-5 h-5 text-gray-600" />
                <h4 className="text-base font-semibold text-gray-800">필터 옵션</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Match Score ≥ {scoreThreshold}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={scoreThreshold}
                    onChange={(e) => setScoreThreshold(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    표시 개수
                  </label>
                  <select
                    value={displayCount}
                    onChange={(e) => setDisplayCount(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value={20}>Top 20</option>
                    <option value={50}>Top 50</option>
                    <option value={100}>Top 100</option>
                    <option value={200}>Top 200</option>
                  </select>
                </div>
              </div>
            </Card>
            
            {/* 다운로드 버튼 */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  // TODO: 엑셀 다운로드 로직 구현
                  console.log('다운로드:', data);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium shadow-lg"
              >
                <Download className="w-5 h-5" />
                결과 내보내기
              </button>
            </div>
          </>
        )}
        
        {/* 초기 상태 */}
        {!isLoading && !error && !data && (
          <Card className="p-12 text-center">
            <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              의미 기반 검색
            </h3>
            <p className="text-gray-500">
              위 검색바에 질의를 입력하여 AI 기반 패널 검색을 시작하세요.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

