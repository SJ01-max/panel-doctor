import React, { useMemo, useState } from 'react';
import { Trophy, Award, Download } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { UnifiedSearchResponse } from '../../../api/search';
import { InsightSummary } from '../../../components/semantic/InsightSummary';
import { BrandAffinityChart } from '../../../components/semantic/BrandAffinityChart';
import { CarTypeChart } from '../../../components/semantic/CarTypeChart';
import { KeywordCloud } from '../../../components/semantic/KeywordCloud';
import { HighlightedText } from '../../../components/semantic/HighlightedText';
import type { PanelItem } from './PanelListCard';

interface SemanticResultListProps {
  searchResult: {
    unified?: UnifiedSearchResponse;
    llm?: any;
  };
  allResults: any[];
  query?: string;
  onPanelClick: (panel: PanelItem) => void;
  onDownloadExcel: () => void;
}

// distance → Match Score (0~100) 변환
const distanceToMatchScore = (distance: number | undefined): number => {
  if (distance === undefined || distance === null) return 50;
  const maxDistance = 2.0;
  const score = Math.max(0, Math.min(100, (1 - distance / maxDistance) * 100));
  return Math.round(score);
};

// 원형 도넛 형태 점수 컴포넌트
const CircleScore: React.FC<{
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}> = ({ score, size = 96, strokeWidth = 8, className = '' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#7c3aed"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-gray-500">Match</span>
        <span className="text-lg font-bold text-gray-900">{score}%</span>
      </div>
    </div>
  );
};

export const SemanticResultList: React.FC<SemanticResultListProps> = ({
  searchResult,
  allResults,
  query = '',
  onPanelClick,
  onDownloadExcel,
}) => {
  const parsedQuery = searchResult.unified?.parsed_query;
  const semanticKeywords = parsedQuery?.semantic_keywords ?? [];
  const rawResults = allResults.length > 0 ? allResults : searchResult.unified?.results ?? [];
  const apiMatchingKeywords: string[] = (searchResult as any)?.unified?.matching_keywords || [];
  // ★ 임베딩 결과 기반 키워드 우선 사용 (LLM 생성 키워드 대신)
  const apiEmbeddingKeywords: string[] = (searchResult as any)?.unified?.embedding_based_keywords || [];
  const apiCommonFeatures: string[] = (searchResult as any)?.unified?.common_features || [];
  const apiSummarySentence: string =
    (searchResult as any)?.unified?.summary_sentence || (searchResult as any)?.unified?.summary || '';
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({});

  const highlightKeywords = useMemo(() => {
    const merged = [...semanticKeywords, ...apiMatchingKeywords]
      .map((kw) => kw?.trim())
      .filter((kw): kw is string => !!kw && kw.length > 0);
    return Array.from(new Set(merged));
  }, [semanticKeywords, apiMatchingKeywords]);

  const processed = useMemo(() => {
    return (rawResults || [])
      .map((row: any, index: number) => {
        // 디버깅: 상위 3개 패널의 match_reasons 확인
        if (index < 3) {
          console.log(`[DEBUG] 패널 ${index + 1} - match_reasons:`, row.match_reasons);
          console.log(`[DEBUG] 패널 ${index + 1} - json_doc 타입:`, typeof row.json_doc);
        }
        let content = row.content as string | undefined;
        if (!content && row.json_doc) {
          if (typeof row.json_doc === 'string') {
            content = row.json_doc;
          } else if (typeof row.json_doc === 'object') {
            // 객체인 경우 모든 값들을 추출해서 텍스트로 변환
            const extractTextFromObject = (obj: any): string => {
              if (typeof obj === 'string') return obj;
              if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
              if (Array.isArray(obj)) {
                return obj.map(extractTextFromObject).join(' | ');
              }
              if (obj && typeof obj === 'object') {
                return Object.values(obj)
                  .map(extractTextFromObject)
                  .filter((v) => v && v.trim())
                  .join(' | ');
              }
              return '';
            };
            content = extractTextFromObject(row.json_doc);
          }
        }

        const matchScore = row.matchScore ?? distanceToMatchScore(row.distance);
        
        // Smart Filtering: 검색어와 관련된 핵심 조각만 추출
        let evidenceSentences: string[] = [];
        
        // 1. json_doc을 | 구분자로 split
        const segments = (content ?? '')
          .split('|')
          .map((segment) => segment?.trim())
          .filter((segment) => !!segment && segment.length > 0);
        
        // 2. semantic_keywords와 검색어를 기반으로 필터링
        // 검색어에서 의미 있는 단어만 추출 (불용어 제거)
        const queryWords = query
          .split(/\s+/)
          .filter((w) => w.length > 1 && !['을', '를', '이', '가', '은', '는', '의', '에', '에서', '와', '과', '중', '좋아하는', '사람', '들'].includes(w))
          .map((w) => w.trim())
          .filter((w) => w.length > 0);
        
        // 모든 검색 키워드 통합 (semantic_keywords + queryWords + apiMatchingKeywords)
        const allSearchTerms = [
          ...semanticKeywords,
          ...apiMatchingKeywords,
          ...highlightKeywords,
          ...queryWords,
        ]
          .map((term) => term?.trim())
          .filter((term) => term && term.length > 1) // 1글자 제외
          .filter((term, index, self) => self.indexOf(term) === index); // 중복 제거
        
        // 3. 각 세그먼트에서 검색어가 포함된 것만 필터링
        // ⚠️ 중요: 질문에 키워드가 있어도 답변 내용을 확인해야 함
        if (allSearchTerms.length > 0) {
          evidenceSentences = segments.filter((segment) => {
            const segmentLower = segment.toLowerCase();
            
            // 검색어 중 하나라도 포함되어 있는지 확인
            const hasKeyword = allSearchTerms.some((term) => {
              const termLower = term.toLowerCase().trim();
              return segmentLower.includes(termLower);
            });
            
            if (!hasKeyword) return false;
            
            // 키워드가 포함되어 있으면, 답변 내용인지 확인
            // 질문 형식 패턴: "?", ":", "여러분은", "어떤", "무엇" 등으로 시작하는 경우 질문일 가능성
            const isQuestionPattern = /^[^|]*[?:]|^[^|]*(여러분은|어떤|무엇|어디|언제|누구|왜|어떻게|있습니까|있나요|입니까|인가요)/i.test(segment);
            
            // 부정 표현 확인 (질의와 반대되는 답변 제외)
            const negativePatterns = [
              /없다|없음|없습니다|없어요|안\s*한다|하지\s*않는다|하지\s*않음|하지\s*않습니다|하지\s*않아요|아니다|아닙니다|아니에요|아니요|아니야|못\s*한다|못함|못합니다|못해요|키워본\s*적\s*없|키워본\s*적\s*없다|키워본\s*적\s*없음|키워본\s*적\s*없습니다|키워본\s*적\s*없어요/i
            ];
            
            // 질문 패턴이면 제외 (질문에 키워드가 있어도 답변이 아니면 매칭 근거로 사용하지 않음)
            if (isQuestionPattern) {
              return false;
            }
            
            // 부정 표현이 있으면 제외 (질의와 반대되는 답변)
            if (negativePatterns.some(pattern => pattern.test(segment))) {
              return false;
            }
            
            // 인구통계 정보 제외
            const isDemographic = /^(성별|나이|연령|지역|출생)[:\s]/i.test(segment.trim());
            if (isDemographic) return false;
            
            // 질의와 무관한 제품 정보 제외 (질의에 해당 키워드가 없으면)
            const queryLower = query.toLowerCase();
            const productKeywords = ['냉장고', '세탁기', '에어컨', 'TV', '노트북', '태블릿', '무선 이어폰', '에어팟'];
            const hasUnrelatedProduct = productKeywords.some(product => {
              if (segmentLower.includes(product.toLowerCase()) && !queryLower.includes(product.toLowerCase())) {
                return true;
              }
              return false;
            });
            if (hasUnrelatedProduct) return false;
            
            return true;
          });
        }
        
        // 4. Fallback: 매칭된 조각이 없으면 LLM match_reasons 사용
        if (evidenceSentences.length === 0) {
          // LLM 생성 match_reasons가 있으면 사용 (인구통계 정보 필터링)
          if (row.match_reasons && Array.isArray(row.match_reasons) && row.match_reasons.length > 0) {
            // 인구통계 정보 필터링
            const demographicPatterns = [
              /^성별[:\s]/i,
              /^나이[:\s]/i,
              /^연령[:\s]/i,
              /^지역[:\s]/i,
              /^출생[:\s]/i,
              /^\d+세/i,
              /^\d+년생/i,
              /남[성자]?[:\s]/i,
              /여[성자]?[:\s]/i,
            ];
            evidenceSentences = row.match_reasons.filter((reason: string) => {
              const trimmed = reason.trim();
              const isDemographic = demographicPatterns.some(pattern => pattern.test(trimmed));
              return !isDemographic && trimmed.length > 2;
            });
          } else if (segments.length > 0) {
            // 그마저도 없으면 앞부분 세그먼트 사용 (최대 3개)
            evidenceSentences = segments.slice(0, 3);
          }
        }
        
        // 전체 세그먼트 목록 (확장용)
        const allSentences = segments;

        return {
          ...row,
          id: row.respondent_id || row.doc_id || row.id,
          age: row.age_text || row.age || '-',
          gender: row.gender || '-',
          region: row.region || '-',
          matchScore,
          content: content ?? '',
          sentences: allSentences, // 전체 세그먼트 목록
          evidenceSentences, // 필터링된 핵심 조각만
          match_reasons: row.match_reasons || [], // 백엔드 match_reasons 보존 (fallback용)
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [rawResults, highlightKeywords]);

  const togglePanelExpansion = (panelId: string) => {
    setExpandedPanels((prev) => ({
      ...prev,
      [panelId]: !prev[panelId],
    }));
  };

  // -----------------------
  // 통계 데이터 계산 (총합, 성별/연령/지역 분포)
  // -----------------------
  const totalCount =
    searchResult.unified?.total_count ?? searchResult.unified?.count ?? processed.length;

  const genderChartData = useMemo(() => {
    // 백엔드에서 성별 통계를 따로 내려주지 않으므로, 프론트에서 계산
    const counts: Record<string, number> = {};

    processed.forEach((row: any) => {
      const g = (row.gender || '').toString();
      let key: string;
      if (['M', '남', '남성', '남자'].some((v) => g.includes(v))) key = '남성';
      else if (['F', '여', '여성', '여자'].some((v) => g.includes(v))) key = '여성';
      else key = '기타';
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [processed]);

  const ageChartData = useMemo(() => {
    // 1순위: 백엔드 age_stats 사용
    const backend = searchResult.unified?.age_stats;
    if (backend && backend.length > 0) {
      return backend.map((a) => {
        const group = a.age_group || '';
        // "20s" -> "20대"
        const label =
          typeof group === 'string' && group.endsWith('s')
            ? `${group.replace('s', '')}대`
            : group || '기타';
        return { name: label, value: a.age_count ?? 0 };
      });
    }

    // 2순위: 프론트에서 즉석 계산
    const counts: Record<string, number> = {};
    processed.forEach((row: any) => {
      const text = (row.age || '').toString();
      const m = text.match(/(\d+)세/);
      if (!m) return;
      const age = parseInt(m[1], 10);
      if (Number.isNaN(age)) return;
      const decade = Math.floor(age / 10) * 10;
      if (decade < 10 || decade > 90) return;
      const key = `${decade}대`;
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => parseInt(a.name, 10) - parseInt(b.name, 10));
  }, [processed, searchResult.unified?.age_stats]);

  const regionChartData = useMemo(() => {
    // 1순위: 백엔드 region_stats 사용
    const backend = searchResult.unified?.region_stats;
    if (backend && backend.length > 0) {
      return backend
        .map((r) => ({
          name: r.region || '기타',
          value: r.region_count ?? 0,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    }

    // 2순위: 프론트에서 즉석 계산
    const counts: Record<string, number> = {};
    processed.forEach((row: any) => {
      const regionText = (row.region || '').toString();
      if (!regionText) return;
      const mainRegion = regionText.split(/\s+/)[0] || regionText;
      counts[mainRegion] = (counts[mainRegion] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [processed, searchResult.unified?.region_stats]);

  const top3 = processed.slice(0, 3);
  const others = processed.slice(3);

  const handleClickPanel = (row: any) => {
    const panel: PanelItem = {
      id: row.id?.toString() || row.respondent_id || '',
      gender: row.gender,
      age: row.age,
      region: row.region,
      matchScore: row.matchScore,
      content: row.content,
      semanticKeywords,
    };
    onPanelClick(panel);
  };

  const renderResultCard = (row: any, options?: { badge?: React.ReactNode }) => {
    const panelId = row.id ?? row.respondent_id ?? row.doc_id ?? row.matchScore;
    
    // 임베딩 기반 실제 매칭 근거 사용 (evidenceSentences)
    const evidence = (row.evidenceSentences as string[]) || [];
    // 전체 sentences (확장용)
    const allSentences = (row.sentences as string[]) || [];
    
    // 표시할 근거: 임베딩 기반 실제 매칭 문장
    const primaryEvidence = evidence;
    
    const isExpanded = !!expandedPanels[panelId];
    const sentencesToRender = isExpanded ? allSentences : primaryEvidence;
    const hasEvidence = sentencesToRender.length > 0;

    return (
      <div
        key={panelId}
        className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4"
      >
        <div className="flex items-start gap-4">
          <CircleScore score={row.matchScore} />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {row.respondent_id || row.id || '패널'}
                </div>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-600">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-gray-700">
                    {row.gender}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-gray-700">
                    {row.age}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-gray-700">
                    {row.region}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {options?.badge}
                <button
                  type="button"
                  onClick={() => handleClickPanel(row)}
                  className="text-xs font-semibold text-violet-600 hover:text-violet-700"
                >
                  패널 상세 보기
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500 mb-2">💡 매칭 근거</div>
          {hasEvidence ? (
            <div className="space-y-2 text-sm text-gray-800 leading-relaxed">
              {sentencesToRender.map((sentence, idx) => (
                <p key={`${panelId}-evidence-${idx}`} className="flex items-start gap-1">
                  <span className="text-violet-500 mt-0.5">•</span>
                  <span>
                    <HighlightedText text={sentence} keywords={highlightKeywords} />
                  </span>
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              임베딩 기반 매칭 근거를 찾지 못했습니다. (evidence: {evidence.length}, sentences: {allSentences.length})
            </p>
          )}

          {allSentences.length > evidence.length && (
            <button
              type="button"
              onClick={() => togglePanelExpansion(panelId)}
              className="mt-3 inline-flex items-center text-xs font-semibold text-violet-600 hover:text-violet-700"
            >
              {isExpanded ? '간단히 보기' : '전체 데이터 보기'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative z-10 w-full max-w-7xl mt-8 pb-20 animate-fade-in">
      {/* 상단 헤더 + 요약 */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">
              의미 기반 매칭 결과
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              AI가 패널의 응답 내용을 분석해 검색어와의 의미적 유사도로 점수를 산정했습니다.
            </p>
          </div>
          <button
            onClick={onDownloadExcel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium shadow hover:bg-violet-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            결과 내보내기
          </button>
        </div>
        {semanticKeywords.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-violet-50 text-violet-700 font-medium">
              매칭 키워드
            </span>
            {semanticKeywords.map((kw, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200"
              >
                #{kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* AI 인사이트 요약 카드 (임베딩 기반 키워드 우선 사용) */}
      <InsightSummary
        summary={apiSummarySentence}
        keywords={apiEmbeddingKeywords.length > 0 ? apiEmbeddingKeywords : apiMatchingKeywords}
        features={apiCommonFeatures}
      />

      {/* 📊 검색 결과 그룹 분석 (데이터 분포 대시보드) */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base md:text-lg font-semibold text-gray-900">
              📊 검색 결과 그룹 분석
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              이번 검색으로 찾아낸 전체 후보 그룹의 분포를 요약해서 보여줍니다.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-44 flex flex-col justify-between">
            <div>
              <div className="text-xs text-gray-500 mb-1">총 검색된 패널 수</div>
              <div className="text-2xl font-bold text-violet-700">
                {totalCount.toLocaleString()}명
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              의미 기반 검색 조건을 충족하는 전체 후보 수입니다.
            </p>
          </div>

          {/* Gender Donut */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-44 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">성별 분포</span>
            </div>
            <div className="flex-1 min-h-0">
              {genderChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={28}
                      outerRadius={40}
                      paddingAngle={4}
                    >
                      {genderChartData.map((entry, index) => {
                        const colors = ['#7c3aed', '#a855f7', '#e5e7eb'];
                        return (
                          <Cell key={`gender-${index}`} fill={colors[index] || colors[0]} />
                        );
                      })}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `${value}명`}
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 8,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[11px] text-gray-400">
                  데이터 없음
                </div>
              )}
            </div>
          </div>

          {/* Age Bar */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-44 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">연령대 분포</span>
            </div>
            <div className="flex-1 min-h-0">
              {ageChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(value: number) => `${value}명`}
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[11px] text-gray-400">
                  데이터 없음
                </div>
              )}
            </div>
          </div>

          {/* Region Bar */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-44 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">주요 거주지 분포</span>
            </div>
            <div className="flex-1 min-h-0">
              {regionChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionChartData} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={70}
                      tick={{ fontSize: 10 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip
                      formatter={(value: number) => `${value}명`}
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#7c3aed" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[11px] text-gray-400">
                  데이터 없음
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 🚗 Brand & Car Type Analysis (브랜드/차량 타입 분석) - 차량 관련 질의일 때만 표시 */}
      {(() => {
        // 질의가 차량/자동차 관련인지 확인
        const carRelatedKeywords = ['차', '자동차', '차량', '브랜드', '모델', '운전', '드라이브', '차고', '소유차', '보유차'];
        const queryLower = query.toLowerCase();
        const keywordsLower = [...apiMatchingKeywords, ...semanticKeywords].map(k => k.toLowerCase());
        const allText = [queryLower, ...keywordsLower].join(' ');
        
        const isCarRelated = carRelatedKeywords.some(keyword => allText.includes(keyword));
        const hasCarData = Object.keys((searchResult as any)?.unified?.brand_top || {}).length > 0 ||
                          Object.keys((searchResult as any)?.unified?.car_type_top || {}).length > 0;
        
        // 차량 관련 질의이고 데이터가 있을 때만 표시
        if (!isCarRelated || !hasCarData) {
          return null;
        }
        
        return (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">🚗 브랜드 및 차량 모델 분석</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Brand Affinity Chart */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <BrandAffinityChart
                  brandAffinity={(searchResult as any)?.unified?.brand_top || {}}
                  maxItems={5}
                />
              </div>

              {/* Car Type Chart */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <CarTypeChart
                  carTypeAffinity={(searchResult as any)?.unified?.car_type_top || {}}
                  maxItems={5}
                />
              </div>
            </div>

            {/* Keyword Cloud */}
            {apiMatchingKeywords.length > 0 && (
              <div className="mt-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <KeywordCloud keywords={apiMatchingKeywords} maxItems={20} />
              </div>
            )}
          </section>
        );
      })()}

      {/* 🏆 Top Match (상위 3명) */}
      {top3.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-bold text-gray-900">Top Match (상위 3명)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {top3.map((row: any, idx: number) =>
              renderResultCard(row, {
                badge:
                  idx === 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
                      최고 점수
                    </span>
                  ) : undefined,
              })
            )}
          </div>
        </section>
      )}

      {/* 🥈 High Relevance (나머지) */}
      {others.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-violet-500" />
            <h3 className="text-lg font-semibold text-gray-900">High Relevance (추가 후보)</h3>
            <span className="text-sm text-gray-500">총 {others.length}명</span>
          </div>
          <div className="space-y-3">
            {others.map((row: any) =>
              renderResultCard(row, {
                badge: (
                  <span className="text-[11px] text-gray-400">
                    {row.matchScore >= 80 ? '높은 매칭' : '관련 있음'}
                  </span>
                ),
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
};


