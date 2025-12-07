import React, { useState, useMemo } from 'react';
import { Brain, Filter, Download, BarChart3, Target, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, CartesianGrid, RadialBarChart, RadialBar } from 'recharts';
import type { UnifiedSearchResponse } from '../../../api/search';
import type { PanelItem } from '../types/PanelItem';
import { buildSemanticSummary, type AgeScorePoint, type RegionScorePoint, type SemanticStats } from '../../../utils/semanticSummary';

interface SemanticSearchResultProps {
  searchResult: {
    unified?: UnifiedSearchResponse;
    llm?: any;
  };
  allResults: any[];
  query?: string;
  onPanelClick: (panel: PanelItem) => void;
  onDownloadExcel: () => void;
}

// distance를 Match Score %로 변환
const distanceToMatchScore = (distance: number): number => {
  const maxDistance = 2.0;
  const score = Math.max(0, Math.min(100, (1 - distance / maxDistance) * 100));
  return Math.round(score);
};

// 유사 단어 매핑 (키워드 확장용)
const getSimilarWords = (keyword: string): string[] => {
  const keywordLower = keyword.toLowerCase();
  const similarWords: string[] = [keyword];
  
  // OTT 관련
  if (keywordLower.includes('ott') || keywordLower.includes('스트리밍') || keywordLower.includes('동영상')) {
    similarWords.push('넷플릭스', '유튜브', '스트리밍', '동영상', '영상', '비디오', '플랫폼', '서비스');
  }
  if (keywordLower.includes('넷플릭스') || keywordLower.includes('유튜브')) {
    similarWords.push('ott', '스트리밍', '동영상', '영상');
  }
  
  // 운동 관련
  if (keywordLower.includes('운동') || keywordLower.includes('체력')) {
    similarWords.push('헬스', '피트니스', '트레이닝', '홈트', '달리기', '걷기', '등산', '요가');
  }
  if (keywordLower.includes('헬스') || keywordLower.includes('피트니스')) {
    similarWords.push('운동', '체력', '트레이닝');
  }
  
  // 직장인 관련
  if (keywordLower.includes('직장인') || keywordLower.includes('직장')) {
    similarWords.push('회사', '직업', '근무', '출근', '직원');
  }
  
  // 쇼핑 관련
  if (keywordLower.includes('쇼핑') || keywordLower.includes('구매')) {
    similarWords.push('구매', '소비', '마켓', '상점', '배송');
  }
  
  // 스마트폰/앱 관련
  if (keywordLower.includes('앱') || keywordLower.includes('스마트폰')) {
    similarWords.push('애플리케이션', '어플', '모바일', '스마트폰', '폰');
  }
  
  // 중복 제거 및 원본 키워드 포함
  return Array.from(new Set(similarWords));
};

// 검색어와 관련된 텍스트 하이라이트 (개선된 버전 - 유사 단어 포함)
const highlightMatchText = (
  text: string, 
  query: string, 
  semanticKeywords?: string[]
): React.ReactNode => {
  if (!text) return text;
  
  // 하이라이트할 키워드 추출 (우선순위: semantic_keywords > query)
  const keywordsToHighlight: string[] = [];
  
  // 1. semantic_keywords 우선 사용
  if (semanticKeywords && semanticKeywords.length > 0) {
    semanticKeywords.forEach(kw => {
      if (kw && kw.trim().length > 1) {
        keywordsToHighlight.push(kw.trim());
        // 유사 단어도 추가
        const similarWords = getSimilarWords(kw.trim());
        similarWords.forEach(sw => {
          if (sw && !keywordsToHighlight.includes(sw)) {
            keywordsToHighlight.push(sw);
          }
        });
      }
    });
  }
  
  // 2. query에서도 키워드 추출 (semantic_keywords가 없거나 부족한 경우)
  if (query && query.trim().length > 0) {
    const queryWords = query.split(/\s+/).filter(w => w.length > 1);
    queryWords.forEach(word => {
      const trimmed = word.trim();
      if (trimmed && !keywordsToHighlight.includes(trimmed)) {
        keywordsToHighlight.push(trimmed);
        // 유사 단어도 추가
        const similarWords = getSimilarWords(trimmed);
        similarWords.forEach(sw => {
          if (sw && !keywordsToHighlight.includes(sw)) {
            keywordsToHighlight.push(sw);
          }
        });
      }
    });
  }
  
  if (keywordsToHighlight.length === 0) return text;
  
  // 모든 키워드를 하나의 정규식으로 결합 (긴 키워드부터 매칭하도록 정렬)
  const sortedKeywords = keywordsToHighlight.sort((a, b) => b.length - a.length);
  const keywordPattern = sortedKeywords
    .map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // 특수문자 이스케이프
    .join('|');
  
  const regex = new RegExp(`(${keywordPattern})`, 'gi');
  const parts: Array<{ text: string; isMatch: boolean }> = [];
  let lastIndex = 0;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index), isMatch: false });
    }
    parts.push({ text: match[0], isMatch: true });
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), isMatch: false });
  }
  
  if (parts.length === 0) return text;
  
  return (
    <span>
      {parts.map((part, idx) => 
        part.isMatch ? (
          <span key={idx} className="bg-yellow-200 font-bold text-gray-900 px-1 rounded">
            {part.text}
          </span>
        ) : (
          <span key={idx}>{part.text}</span>
        )
      )}
    </span>
  );
};

export const SemanticSearchResult: React.FC<SemanticSearchResultProps> = ({
  searchResult,
  allResults,
  query = '',
  onPanelClick,
  onDownloadExcel
}) => {
  const [similarityThreshold, setSimilarityThreshold] = useState(50);
  const [selectedAgeFilter, setSelectedAgeFilter] = useState<string>('all');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('all');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');
  
  const parsedQuery = searchResult.unified?.parsed_query;
  const results = allResults.length > 0 ? allResults : (searchResult.unified?.results || []);
  
  // query fallback: query prop이 없으면 parsedQuery에서 추출하거나 semantic_keywords 사용
  const effectiveQuery = query || parsedQuery?.semantic_keywords?.join(' ') || '';
  
  // Match Score 기준으로 정렬 및 필터링
  const processedResults = useMemo(() => {
    return results
      .map(row => {
        // content 필드 추출 (json_doc에서 텍스트 추출 또는 content 직접 사용)
        let content = row.content;
        if (!content && row.json_doc) {
          // json_doc이 문자열이면 그대로 사용, 객체면 JSON.stringify
          if (typeof row.json_doc === 'string') {
            content = row.json_doc;
          } else if (typeof row.json_doc === 'object') {
            content = JSON.stringify(row.json_doc);
          }
        }
        
        return {
          ...row,
          matchScore: row.distance !== undefined ? distanceToMatchScore(row.distance) : 50,
          age: row.age_text || row.age || '-',
          gender: row.gender || '-',
          region: row.region || '-',
          content: content || '' // content 필드 보장
        };
      })
      .filter(row => {
        if (row.matchScore < similarityThreshold) return false;
        if (selectedAgeFilter !== 'all') {
          const ageMatch = row.age.match(/(\d+)세/);
          if (ageMatch) {
            const age = parseInt(ageMatch[1]);
            const decade = Math.floor(age / 10) * 10;
            if (selectedAgeFilter !== `${decade}대`) return false;
          }
        }
        if (selectedGenderFilter !== 'all') {
          const genderMap: Record<string, string[]> = {
            '남': ['남', 'M', '남성', '남자'],
            '여': ['여', 'F', '여성', '여자']
          };
          const allowed = genderMap[selectedGenderFilter] || [];
          if (!allowed.some(g => row.gender.includes(g))) return false;
        }
        if (selectedRegionFilter !== 'all') {
          const mainRegion = row.region.split(/\s+/)[0];
          if (mainRegion !== selectedRegionFilter) return false;
        }
        return true;
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      // 인사이트/키워드/리스트용 상위 패널 집합: Top 1000으로 고정
      .slice(0, 1000);
  }, [results, similarityThreshold, selectedAgeFilter, selectedGenderFilter, selectedRegionFilter]);
  
  // 통계 계산 (processedResults가 비어있으면 results 사용)
  const stats = useMemo(() => {
    // processedResults가 비어있으면 원본 results 사용
    const dataToUse = processedResults.length > 0 ? processedResults : results.map(row => ({
      ...row,
      matchScore: row.distance !== undefined ? distanceToMatchScore(row.distance) : 50,
      age: row.age_text || row.age || '-',
      gender: row.gender || '-',
      region: row.region || '-'
    }));
    
    if (dataToUse.length === 0) {
      return {
        avgScore: 0,
        maxScore: 0,
        top10PercentAvg: 0,
        totalPanels: 0,
        highMatchPercent: 0,
        mainAgeGroup: '-',
        mainRegion: '-',
        relatedKeywords: []
      };
    }
    
    const scores = dataToUse.map(r => r.matchScore).sort((a, b) => b - a);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const maxScore = scores[0];
    const top10Count = Math.max(1, Math.floor(scores.length * 0.1));
    const top10PercentAvg = Math.round(scores.slice(0, top10Count).reduce((a, b) => a + b, 0) / top10Count);
    
    // 높은 매칭 비율 (70% 이상)
    const highMatchCount = scores.filter(s => s >= 70).length;
    const highMatchPercent = Math.round((highMatchCount / scores.length) * 100);
    
    // 주요 연령대
    const ageGroups: Record<string, number> = {};
    dataToUse.forEach(r => {
      const ageText = r.age_text || r.age || '-';
      const ageMatch = ageText.match(/(\d+)세/);
      if (ageMatch) {
        const age = parseInt(ageMatch[1]);
        const decade = Math.floor(age / 10) * 10;
        const key = `${decade}대`;
        ageGroups[key] = (ageGroups[key] || 0) + 1;
      }
    });
    const mainAgeGroup = Object.entries(ageGroups).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    
    // 주요 지역
    const regions: Record<string, number> = {};
    dataToUse.forEach(r => {
      const regionText = r.region || '-';
      const mainRegion = regionText.split(/\s+/)[0];
      if (mainRegion && mainRegion !== '-') {
        regions[mainRegion] = (regions[mainRegion] || 0) + 1;
      }
    });
    const mainRegion = Object.entries(regions).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    
    // 연관 키워드 (검색어에서 추출)
    const relatedKeywords = parsedQuery?.semantic_keywords || [];
    
    return {
      avgScore,
      maxScore,
      top10PercentAvg,
      totalPanels: dataToUse.length,
      highMatchPercent,
      mainAgeGroup,
      mainRegion,
      relatedKeywords
    };
  }, [processedResults, results, parsedQuery]);
  
  // 히스토그램 데이터 (processedResults가 비어있으면 results 사용)
  const histogramData = useMemo(() => {
    const dataToUse = processedResults.length > 0 ? processedResults : results.map(row => ({
      matchScore: row.distance !== undefined ? distanceToMatchScore(row.distance) : 50
    }));
    
    const bins: Record<string, number> = {
      '90-100': 0,
      '80-90': 0,
      '70-80': 0,
      '60-70': 0,
      '50-60': 0,
      '0-50': 0
    };
    
    dataToUse.forEach(row => {
      const score = row.matchScore || 50;
      if (score >= 90) bins['90-100']++;
      else if (score >= 80) bins['80-90']++;
      else if (score >= 70) bins['70-80']++;
      else if (score >= 60) bins['60-70']++;
      else if (score >= 50) bins['50-60']++;
      else bins['0-50']++;
    });
    
    return Object.entries(bins)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .reverse();
  }, [processedResults, results]);
  
  // Scatter plot 데이터 (Score vs Age) (processedResults가 비어있으면 results 사용)
  const scatterData = useMemo(() => {
    const dataToUse = processedResults.length > 0 ? processedResults : results.map(row => ({
      age: row.age_text || row.age || '-',
      matchScore: row.distance !== undefined ? distanceToMatchScore(row.distance) : 50
    }));
    
    return dataToUse
      .map(row => {
        const ageText = row.age || '-';
        const ageMatch = ageText.match(/(\d+)세/);
        const age = ageMatch ? parseInt(ageMatch[1]) : null;
        return age !== null ? { age, score: row.matchScore || 50 } : null;
      })
      .filter((d): d is { age: number; score: number } => d !== null)
      .slice(0, 100); // 최대 100개만 표시
  }, [processedResults, results]);
  
  // 지역별 Score bar chart 데이터 (processedResults가 비어있으면 results 사용)
  const regionScoreData = useMemo(() => {
    const dataToUse = processedResults.length > 0 ? processedResults : results.map(row => ({
      region: row.region || '-',
      matchScore: row.distance !== undefined ? distanceToMatchScore(row.distance) : 50
    }));
    
    const regionScores: Record<string, { count: number; totalScore: number }> = {};
    
    dataToUse.forEach(row => {
      const regionText = row.region || '-';
      const mainRegion = regionText.split(/\s+/)[0];
      if (mainRegion && mainRegion !== '-') {
        if (!regionScores[mainRegion]) {
          regionScores[mainRegion] = { count: 0, totalScore: 0 };
        }
        regionScores[mainRegion].count++;
        regionScores[mainRegion].totalScore += row.matchScore || 50;
      }
    });
    
    return Object.entries(regionScores)
      .map(([name, data]) => ({
        name,
        avgScore: Math.round(data.totalScore / data.count),
        count: data.count
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);
  }, [processedResults, results]);
  
  // 고유 지역 목록
  const uniqueRegions = useMemo(() => {
    const regions = new Set<string>();
    processedResults.forEach(r => {
      const mainRegion = r.region.split(/\s+/)[0];
      if (mainRegion) regions.add(mainRegion);
    });
    return Array.from(regions).sort();
  }, [processedResults]);
  
  // AI 해석 요약 문장 생성
  const aiSummaryText = useMemo(() => {
    // scatterData를 AgeScorePoint[] 형태로 변환
    const ageScores: AgeScorePoint[] = scatterData.map(d => ({ age: d.age, score: d.score }));
    
    // regionScoreData를 RegionScorePoint[] 형태로 변환
    const regionScores: RegionScorePoint[] = regionScoreData.map(d => ({ 
      region: d.name, 
      score: d.avgScore 
    }));
    
    // SemanticStats 객체 생성
    const semanticStats: SemanticStats = {
      avgScore: stats.avgScore,
      maxScore: stats.maxScore,
      candidateCount: stats.totalPanels
    };
    
    // 요약 문장 생성
    const summaryText = buildSemanticSummary(semanticStats, ageScores, regionScores);
    
    // 마크다운 ** ** 제거 (간단한 처리)
    return summaryText.replace(/\*\*/g, '');
  }, [scatterData, regionScoreData, stats]);
  
  return (
    <div className="relative z-10 w-full max-w-7xl mt-8 pb-20 animate-fade-in">
      {/* ① AI 인사이트 요약 카드 - AI 해석 요약 통합 */}
      <div className="bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-white" />
          <h2 className="text-xl font-bold text-white">🧠 AI 인사이트 요약</h2>
        </div>
        
        {/* AI 해석 요약 텍스트 - 폰트 개선 */}
        <div className="bg-white/95 rounded-xl p-5 mb-4 border border-white/50">
          <div className="space-y-2">
            {aiSummaryText.split('**').map((part, idx) => {
              // **로 감싸진 부분은 강조 표시 (더 예쁜 스타일)
              if (idx % 2 === 1) {
                return (
                  <span key={idx} className="inline-block px-3 py-1.5 bg-gradient-to-r from-purple-100 via-indigo-100 to-blue-100 text-purple-800 font-bold rounded-lg mx-1 shadow-sm text-base">
                    {part}
                  </span>
                );
              }
              return (
                <span key={idx} className="text-base leading-relaxed text-gray-800 font-medium" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {part}
                </span>
              );
            })}
          </div>
        </div>
        
        <div className="bg-white/95 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">전체 패널 중 높은 유사도</div>
            <div className="text-2xl font-bold text-violet-600">{stats.highMatchPercent}%</div>
            <div className="text-xs text-gray-600 mt-1">검색 의도와 높은 유사도</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">주요 타겟 그룹</div>
            <div className="text-lg font-bold text-indigo-600">{stats.mainAgeGroup}</div>
            <div className="text-sm text-gray-600 mt-1">{stats.mainRegion} 지역</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">평균 Match Score</div>
            <div className="text-2xl font-bold text-blue-600">{stats.avgScore}%</div>
            <div className="text-xs text-gray-600 mt-1">/ 5.0 기준</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">연관 키워드</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {stats.relatedKeywords.slice(0, 3).map((kw, idx) => (
                <span key={idx} className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-medium">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* ② Match Score 종합 분석 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-2">평균 점수</div>
          <div className="text-2xl font-bold text-violet-600">{stats.avgScore}%</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-2">최고 점수</div>
          <div className="text-2xl font-bold text-green-600">{stats.maxScore}%</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-2">상위 10% 평균</div>
          <div className="text-2xl font-bold text-blue-600">{stats.top10PercentAvg}%</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-2">후보 패널 수</div>
          <div className="text-2xl font-bold text-indigo-600">{stats.totalPanels}명</div>
        </div>
      </div>
      
      {/* ③ Match Score 분포 차트 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-violet-600" />
          Match Score 분석
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 평균 적합도 게이지 - RadialBarChart */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">평균 적합도</h4>
            {(() => {
              // processedResults 또는 results에서 scores 배열 추출 및 평균값 계산
              const dataToUse = processedResults.length > 0 
                ? processedResults 
                : results.map(row => ({
                    ...row,
                    matchScore: row.distance !== undefined ? distanceToMatchScore(row.distance) : 50
                  }));
              
              const scores = dataToUse.map(r => r.matchScore || 0);
              const avgScore = scores.length > 0 
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : 0;
              
              // 점수에 따라 색상 결정 (Emerald 90+, Violet 70+, Amber Low)
              const getGaugeColor = (score: number): string => {
                if (score >= 90) return '#10b981'; // Emerald
                if (score >= 70) return '#8b5cf6'; // Violet
                return '#f59e0b'; // Amber
              };
              
              const gaugeColor = getGaugeColor(avgScore);
              
              // RadialBarChart용 데이터 (반원 180도)
              const gaugeData = [
                {
                  name: 'score',
                  value: avgScore,
                  fill: gaugeColor
                },
                {
                  name: 'remaining',
                  value: 100 - avgScore,
                  fill: '#e5e7eb'
                }
              ];
              
              return (
                <div className="relative w-full" style={{ height: '280px', paddingBottom: '20px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="65%"
                      innerRadius="35%"
                      outerRadius="70%"
                      barSize={18}
                      data={gaugeData}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar
                        dataKey="value"
                        cornerRadius={10}
                        fill="#8884d8"
                      >
                        {gaugeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </RadialBar>
                    </RadialBarChart>
                  </ResponsiveContainer>
                  {/* 중앙 텍스트 */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingTop: '35%' }}>
                    <div className="text-5xl font-bold" style={{ color: gaugeColor }}>
                      {avgScore}
                    </div>
                    <div className="text-sm font-medium text-gray-600 mt-1">
                      평균 적합도
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {scores.length}개 패널
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          
          {/* Scatter Plot - 개선된 스타일 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">연령별 Score 상관 그래프</h4>
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart data={scatterData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="age" 
                  name="연령" 
                  type="number" 
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  dataKey="score" 
                  name="Score" 
                  type="number" 
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3', stroke: '#7c3aed', strokeWidth: 1 }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Scatter 
                  dataKey="score" 
                  fill="#7c3aed"
                  shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill="#7c3aed"
                        fillOpacity={0.6}
                        stroke="#8b5cf6"
                        strokeWidth={1}
                      />
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* 지역별 Score Bar Chart - 개선된 스타일 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">지역별 Score (Top 5)</h4>
          {regionScoreData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={regionScoreData} layout="vertical" barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  type="number" 
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={90}
                  tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg text-sm">
                          <p className="font-bold text-gray-900 mb-2">{data.name}</p>
                          <div className="space-y-1">
                            <p className="text-purple-600 font-semibold">평균 Score: <span className="text-gray-900">{data.avgScore}%</span></p>
                            <p className="text-gray-600">패널 수: <span className="font-medium">{data.count}명</span></p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="avgScore" radius={[0, 12, 12, 0]} barSize={45}>
                  {regionScoreData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`url(#regionGradient${index})`}
                    />
                  ))}
                </Bar>
                <defs>
                  {regionScoreData.map((entry, index) => (
                    <linearGradient key={index} id={`regionGradient${index}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={1} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.8} />
                    </linearGradient>
                  ))}
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              지역별 Score 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>
      
      {/* ④ AI 조건 해석 + 의미 키워드 클라우드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* AI 조건 해석 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-violet-600" />
            AI가 이해한 조건
          </h3>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">감정/특징</div>
              <div className="text-sm font-medium text-gray-900">
                {parsedQuery?.semantic_keywords?.join(', ') || query}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">연관 키워드</div>
              <div className="flex flex-wrap gap-2">
                {stats.relatedKeywords.map((kw, idx) => (
                  <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">특징</div>
              <div className="text-sm text-gray-700">
                {parsedQuery?.intent || '의미 기반 질의로 판단됨'}
              </div>
            </div>
          </div>
        </div>
        
        {/* 의미 키워드 클라우드 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            의미 키워드 클라우드
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.relatedKeywords.map((kw, idx) => {
              const intensity = idx < 3 ? 'strong' : idx < 6 ? 'medium' : 'weak';
              const colorClass = intensity === 'strong' 
                ? 'bg-violet-600 text-white font-bold' 
                : intensity === 'medium'
                ? 'bg-violet-300 text-violet-900 font-semibold'
                : 'bg-violet-100 text-violet-700';
              const sizeClass = intensity === 'strong' 
                ? 'text-base px-4 py-2' 
                : intensity === 'medium'
                ? 'text-sm px-3 py-1.5'
                : 'text-xs px-2 py-1';
              
              return (
                <span
                  key={idx}
                  className={`${colorClass} ${sizeClass} rounded-full`}
                >
                  #{kw}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* ⑤ 필터 UI */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h4 className="text-base font-semibold text-gray-800">필터 옵션</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="text-xs text-gray-600 mb-2 block">Match Score ≥</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-medium text-violet-600 w-12 text-right">
                {similarityThreshold}%
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-2 block">연령</label>
            <select
              value={selectedAgeFilter}
              onChange={(e) => setSelectedAgeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="all">전체</option>
              <option value="20대">20대</option>
              <option value="30대">30대</option>
              <option value="40대">40대</option>
              <option value="50대">50대</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-2 block">성별</label>
            <select
              value={selectedGenderFilter}
              onChange={(e) => setSelectedGenderFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="all">전체</option>
              <option value="남">남성</option>
              <option value="여">여성</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-2 block">지역</label>
            <select
              value={selectedRegionFilter}
              onChange={(e) => setSelectedRegionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="all">전체</option>
              {uniqueRegions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
          {/* 표시 개수 드롭다운 제거하고 Top 200 고정 */}
        </div>
      </div>
      
      {/* 다운로드 버튼 */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={onDownloadExcel}
          className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium shadow-lg"
        >
          <Download className="w-5 h-5" />
          결과 내보내기
        </button>
      </div>
    </div>
  );
};
