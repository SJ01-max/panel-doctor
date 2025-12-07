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
  LabelList,
} from 'recharts';
import type { UnifiedSearchResponse } from '../../../api/search';

import { HighlightedText } from '../../../components/semantic/HighlightedText';
import { ModernTable } from '../../../components/ModernTable';
import type { PanelItem } from '../types/PanelItem';

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
  }, [rawResults, highlightKeywords, query, semanticKeywords, apiMatchingKeywords]);

  // 🔎 핵심 키워드 통계 (Top 8) - 백엔드 키워드 + 실제 패널 응답 기반
  const keywordStats = useMemo(() => {
    // 우선순위: 임베딩 기반 키워드 > 매칭 키워드 > semantic_keywords
    const baseKeywords =
      apiEmbeddingKeywords.length > 0
        ? apiEmbeddingKeywords
        : apiMatchingKeywords.length > 0
        ? apiMatchingKeywords
        : semanticKeywords;

    if (!baseKeywords || baseKeywords.length === 0 || processed.length === 0) {
      return [];
    }

    const keywordSet = Array.from(
      new Set(
        baseKeywords
          .map((k) => k?.trim())
          .filter((k): k is string => !!k && k.length > 1)
      )
    );

    if (keywordSet.length === 0) return [];

    const stats = keywordSet.map((keyword) => {
      const kwLower = keyword.toLowerCase();
      let panelCount = 0;

      processed.forEach((row: any) => {
        const content = (row.content || '').toString();
        const sentences: string[] = (row.sentences as string[]) || [];
        const evidence: string[] = (row.evidenceSentences as string[]) || [];

        const haystack = [
          content,
          ...sentences,
          ...evidence,
          ...(row.match_reasons || []),
        ]
          .filter((s) => !!s)
          .join(' | ')
          .toLowerCase();

        if (haystack.includes(kwLower)) {
          panelCount += 1;
        }
      });

      const ratio =
        processed.length > 0
          ? Math.round((panelCount / processed.length) * 100)
          : 0;

      return {
        keyword,
        panelCount,
        ratio,
      };
    });

    return stats
      .filter((s) => s.panelCount > 0)
      .sort((a, b) => b.panelCount - a.panelCount)
      .slice(0, 8);
  }, [processed, apiEmbeddingKeywords, apiMatchingKeywords, semanticKeywords]);

  // 키워드 연관성 분석 (강한/중간/독립 키워드)
  const keywordRelations = useMemo(() => {
    if (keywordStats.length === 0 || processed.length === 0) {
      return {
        strong: [] as Array<{ pair: [string, string]; ratio: number }>,
        medium: [] as Array<{ pair: [string, string]; ratio: number }>,
        independent: [] as Array<{ keyword: string; soloRatio: number }>,
      };
    }

    const keywords = keywordStats.map((k) => k.keyword);
    const pairCount: Record<string, number> = {};
    const singleCount: Record<string, number> = {};

    processed.forEach((row: any) => {
      const content = (row.content || '').toString().toLowerCase();
      const sentences: string[] = (row.sentences as string[]) || [];
      const evidence: string[] = (row.evidenceSentences as string[]) || [];
      const haystack = [
        content,
        ...sentences,
        ...evidence,
        ...(row.match_reasons || []),
      ]
        .filter((s) => !!s)
        .join(' | ')
        .toLowerCase();

      const present: string[] = [];
      keywords.forEach((kw) => {
        const kwLower = kw.toLowerCase();
        if (haystack.includes(kwLower)) {
          present.push(kw);
          singleCount[kw] = (singleCount[kw] || 0) + 1;
        }
      });

      // 페어 카운트
      for (let i = 0; i < present.length; i += 1) {
        for (let j = i + 1; j < present.length; j += 1) {
          const [a, b] = [present[i], present[j]].sort();
          const key = `${a}|||${b}`;
          pairCount[key] = (pairCount[key] || 0) + 1;
        }
      }
    });

    const strong: Array<{ pair: [string, string]; ratio: number }> = [];
    const medium: Array<{ pair: [string, string]; ratio: number }> = [];

    Object.entries(pairCount).forEach(([key, count]) => {
      const [a, b] = key.split('|||') as [string, string];
      const base = Math.min(singleCount[a] || 1, singleCount[b] || 1);
      const ratio = base > 0 ? count / base : 0;
      if (ratio >= 0.7) {
        strong.push({ pair: [a, b], ratio });
      } else if (ratio >= 0.4) {
        medium.push({ pair: [a, b], ratio });
      }
    });

    strong.sort((x, y) => y.ratio - x.ratio);
    medium.sort((x, y) => y.ratio - x.ratio);

    // 독립 키워드: 함께 등장 비율이 낮은 키워드
    const independent: Array<{ keyword: string; soloRatio: number }> = [];
    keywords.forEach((kw) => {
      const total = singleCount[kw] || 0;
      if (total === 0) return;

      // 이 키워드가 등장한 패널 중 다른 키워드와 같이 나온 비율 추정
      let withOthers = 0;
      Object.entries(pairCount).forEach(([key, count]) => {
        if (key.includes(`${kw}|||`) || key.endsWith(`|||${kw}`)) {
          withOthers += count;
        }
      });
      const withRatio = Math.min(1, withOthers / total);
      const soloRatio = 1 - withRatio;

      if (soloRatio >= 0.5) {
        independent.push({ keyword: kw, soloRatio });
      }
    });

    independent.sort((a, b) => b.soloRatio - a.soloRatio);

    return {
      strong: strong.slice(0, 3),
      medium: medium.slice(0, 3),
      independent: independent.slice(0, 3),
    };
  }, [keywordStats, processed]);

  const togglePanelExpansion = (panelId: string) => {
    setExpandedPanels((prev) => ({
      ...prev,
      [panelId]: !prev[panelId],
    }));
  };

  // -----------------------
  // 통계 데이터 계산 (총합, 성별/연령/지역 분포)
  // -----------------------
  // ★ 사용자가 limit을 요청했을 때는 실제 반환된 count를 사용
  const requestedLimit = parsedQuery?.limit;
  const actualResultCount = processed.length;
  const totalCountInDB = searchResult.unified?.total_count ?? searchResult.unified?.count ?? actualResultCount;
  const totalCount = (requestedLimit && requestedLimit > 0) 
    ? (searchResult.unified?.count ?? actualResultCount)  // 사용자가 limit 요청 시 실제 반환된 count 사용
    : totalCountInDB;  // limit이 없으면 total_count 사용

  const genderChartData = useMemo(() => {
    // 1순위: 백엔드 gender_stats 사용 (server-side aggregation) - 전체 검색 결과 기반인 경우
    const backend = (searchResult.unified as any)?.gender_stats as
      | Array<{ gender: string; gender_count?: number; count?: number }>
      | undefined;
    if (backend && backend.length > 0) {
      // 백엔드 통계의 총합이 totalCount와 일치하는지 확인
      const backendTotal = backend.reduce((sum, g) => sum + (g.gender_count ?? g.count ?? 0), 0);
      // 백엔드 통계가 전체 검색 결과를 기반으로 한 경우 (totalCount와 비슷한 경우)
      if (Math.abs(backendTotal - totalCount) < totalCount * 0.1) {
        return backend
          .map((g) => {
            const raw = (g.gender || '').toString();
            let name: string;
            if (['M', '남', '남성', '남자'].some((v) => raw.includes(v))) name = '남성';
            else if (['F', '여', '여성', '여자'].some((v) => raw.includes(v))) name = '여성';
            else name = '기타';
            const value = g.gender_count ?? g.count ?? 0;
            return { name, value };
          })
          .filter((item) => item.name !== '기타'); // 기타 제외
      }
    }

    // 2순위: processed 기준으로 계산하고 totalCount에 맞게 스케일링
    const counts: Record<string, number> = {};

    processed.forEach((row: any) => {
      const g = (row.gender || '').toString();
      let key: string;
      if (['M', '남', '남성', '남자'].some((v) => g.includes(v))) key = '남성';
      else if (['F', '여', '여성', '여자'].some((v) => g.includes(v))) key = '여성';
      else key = '기타';
      counts[key] = (counts[key] || 0) + 1;
    });

    // 샘플 기반 통계를 전체 검색 결과 수에 맞게 스케일링
    const sampleTotal = processed.length;
    if (sampleTotal > 0 && totalCount > 0) {
      const scaleFactor = totalCount / sampleTotal;
      return Object.entries(counts)
        .filter(([name]) => name !== '기타') // 기타 제외
        .map(([name, value]) => ({
          name,
          value: Math.round(value * scaleFactor),
        }));
    }

    return Object.entries(counts)
      .filter(([name]) => name !== '기타') // 기타 제외
      .map(([name, value]) => ({ name, value }));
  }, [processed, searchResult.unified, totalCount]);

  const ageChartData = useMemo(() => {
    // 1순위: 백엔드 age_stats 사용 - 전체 검색 결과 기반인 경우
    const backend = searchResult.unified?.age_stats;
    if (backend && backend.length > 0) {
      // 백엔드 통계의 총합이 totalCount와 일치하는지 확인
      const backendTotal = backend.reduce((sum, a) => sum + (a.age_count ?? 0), 0);
      // 백엔드 통계가 전체 검색 결과를 기반으로 한 경우 (totalCount와 비슷한 경우)
      if (Math.abs(backendTotal - totalCount) < totalCount * 0.1) {
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
    }

    // 2순위: 프론트에서 즉석 계산하고 totalCount에 맞게 스케일링
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

    // 샘플 기반 통계를 전체 검색 결과 수에 맞게 스케일링
    const sampleTotal = processed.length;
    const scaledData = sampleTotal > 0 && totalCount > 0
      ? Object.entries(counts).map(([name, value]) => ({
          name,
          value: Math.round(value * (totalCount / sampleTotal)),
        }))
      : Object.entries(counts).map(([name, value]) => ({ name, value }));

    return scaledData.sort((a, b) => parseInt(a.name, 10) - parseInt(b.name, 10));
  }, [processed, searchResult.unified?.age_stats, totalCount]);

  const regionChartData = useMemo(() => {
    // 1순위: 백엔드 region_stats 사용 - 전체 검색 결과 기반인 경우
    const backend = searchResult.unified?.region_stats;
    if (backend && backend.length > 0) {
      // 백엔드 통계의 총합이 totalCount와 일치하는지 확인
      const backendTotal = backend.reduce((sum, r) => sum + (r.region_count ?? 0), 0);
      // 백엔드 통계가 전체 검색 결과를 기반으로 한 경우 (totalCount와 비슷한 경우)
      if (Math.abs(backendTotal - totalCount) < totalCount * 0.1) {
      return backend
        .map((r) => ({
          name: r.region || '기타',
          value: r.region_count ?? 0,
        }))
          .sort((a, b) => b.value - a.value);
      }
    }

    // 2순위: 프론트에서 즉석 계산하고 totalCount에 맞게 스케일링
    const counts: Record<string, number> = {};
    processed.forEach((row: any) => {
      const regionText = (row.region || '').toString();
      if (!regionText) return;
      const mainRegion = regionText.split(/\s+/)[0] || regionText;
      counts[mainRegion] = (counts[mainRegion] || 0) + 1;
    });

    // 샘플 기반 통계를 전체 검색 결과 수에 맞게 스케일링
    const sampleTotal = processed.length;
    const scaledData = sampleTotal > 0 && totalCount > 0
      ? Object.entries(counts).map(([name, value]) => ({
          name,
          value: Math.round(value * (totalCount / sampleTotal)),
        }))
      : Object.entries(counts).map(([name, value]) => ({ name, value }));

    return scaledData.sort((a, b) => b.value - a.value);
  }, [processed, searchResult.unified?.region_stats, totalCount]);

  // 성별/연령대 퍼센트 계산용 총합
  const totalGenderCount = useMemo(
    () => genderChartData.reduce((sum, item) => sum + (item.value || 0), 0),
    [genderChartData],
  );

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

      {/* 📊 검색 결과 그룹 분석 (데이터 분포 대시보드) */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
              📊 검색 결과 그룹 분석
            </h3>
            <p className="text-base text-gray-600">
              이번 검색으로 찾아낸 전체 후보 그룹의 분포를 요약해서 보여줍니다.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 h-60 flex flex-col justify-between">
            <div>
              <div className="text-base font-semibold text-gray-700 mb-3">총 검색된 패널 수</div>
              <div className="text-4xl font-bold text-violet-700 mb-3">
                {totalCount.toLocaleString()}
                <span className="text-2xl text-gray-500 ml-1.5 font-normal">명</span>
              </div>
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-600 leading-relaxed font-normal">
                의미 기반 검색 조건을 충족하는<br />
                전체 후보 수입니다.
              </p>
            </div>
          </div>

          {/* Gender Donut - 남성(블루 계열), 여성(레드 계열), 기타(그레이) + 퍼센트 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 h-60 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-semibold text-gray-700">성별 분포</span>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              {genderChartData.length > 0 ? (
                <>
                  <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderChartData}
                      dataKey="value"
                      nameKey="name"
                          innerRadius={35}
                          outerRadius={50}
                      paddingAngle={4}
                    >
                      {genderChartData.map((entry, index) => {
                            let fill = '#9ca3af'; // 기타: gray
                            if (entry.name === '남성') fill = '#3b82f6'; // blue-500
                            else if (entry.name === '여성') fill = '#f97373'; // red-400
                            return <Cell key={`gender-${index}`} fill={fill} />;
                      })}
                    </Pie>
                    <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload[0]) {
                              const d: any = payload[0].payload;
                              const count = d.value || 0;
                              const pct =
                                totalGenderCount > 0
                                  ? Math.round((count / totalGenderCount) * 100)
                                  : 0;
                              return (
                                <div className="bg-white px-3 py-2 rounded-lg shadow border border-slate-200 text-[11px]">
                                  <div className="font-semibold text-slate-900 mb-1">
                                    {d.name}
                                  </div>
                                  <div className="text-slate-600">
                                    {count.toLocaleString()}명 (
                                    <span className="font-semibold">{pct}%</span>)
                                  </div>
                                </div>
                              );
                            }
                            return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                  </div>
                  {/* 성별 라벨과 퍼센트 표시 */}
                  <div className="flex items-center justify-center gap-6 mt-3">
                    {genderChartData.map((entry) => {
                      const count = entry.value || 0;
                      const pct =
                        totalGenderCount > 0
                          ? Math.round((count / totalGenderCount) * 100)
                          : 0;
                      const isMale = entry.name === '남성';
                      const isFemale = entry.name === '여성';
                      const color = isMale
                        ? '#3b82f6'
                        : isFemale
                        ? '#f97373'
                        : '#9ca3af';
                      const label = isMale ? '남' : isFemale ? '여' : entry.name;
                      
                      return (
                        <div
                          key={entry.name}
                          className="flex items-center gap-3"
                        >
                          <div
                            className="w-4 h-4 rounded-full shadow-md"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-base font-bold text-gray-800">
                            {label}
                          </span>
                          <span className="text-base font-bold text-gray-900">
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  데이터 없음
                </div>
              )}
            </div>
          </div>

          {/* Age Bar / 단일 연령대 전용 카드 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 h-60 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-semibold text-gray-700">연령대 분포</span>
            </div>
            <div className="flex-1 min-h-0">
              {ageChartData.length > 0 ? (
                ageChartData.length === 1 ? (
                  // 단일 연령대일 때는 카드 형태로 예쁘게 표시
                  (() => {
                    const only = ageChartData[0];
                    const total = only.value || 0;
                    // 전체 패널 수 대비 비율 (대략)
                    const ratio =
                      totalCount > 0 ? Math.round((total / totalCount) * 100) : 0;
                    return (
                      <div className="flex items-center justify-center h-full">
                        <div className="inline-flex flex-col items-center justify-center px-6 py-5 rounded-2xl bg-violet-50 border border-violet-200 shadow-md">
                          <div className="text-sm font-semibold text-violet-600 mb-2">
                            주요 연령대
                          </div>
                          <div className="text-3xl font-bold text-violet-700 mb-3">
                            {only.name}
                          </div>
                          <div className="text-base text-slate-700">
                            전체의{' '}
                            <span className="font-bold text-violet-700">
                              {ratio}%
                            </span>
                            를 차지합니다.
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e5e7eb"
                      />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 13, fill: '#4b5563', fontWeight: 600 }}
                      axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                    />
                    <YAxis
                      tick={{ fontSize: 13, fill: '#4b5563', fontWeight: 600 }}
                      axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(value: number) => `${value.toLocaleString()}명`}
                      contentStyle={{
                        fontSize: 14,
                        borderRadius: 8,
                        fontWeight: 600,
                        padding: '8px 12px',
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
                )
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  데이터 없음
                </div>
              )}
            </div>
          </div>

          {/* Region Bar (Top 5) - 연령대 분포처럼 세로 막대 그래프 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 h-60 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-semibold text-gray-700">주요 거주지 분포</span>
            </div>
            <div className="flex-1 min-h-0">
              {regionChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionChartData.slice(0, 5)}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e5e7eb"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 13, fill: '#4b5563', fontWeight: 600 }}
                      axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                    />
                    <YAxis
                      tick={{ fontSize: 13, fill: '#4b5563', fontWeight: 600 }}
                      axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(value: number) => `${value.toLocaleString()}명`}
                      contentStyle={{
                        fontSize: 14,
                        borderRadius: 8,
                        fontWeight: 600,
                        padding: '8px 12px',
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#7c3aed" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  데이터 없음
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 🔥 이 집단이 추구하는 핵심 키워드 Top 8 */}
      {keywordStats.length > 0 && (
        <section className="mt-8 mb-10">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center px-5 py-1.5 rounded-full bg-white shadow-sm border border-slate-100 text-sm font-semibold text-slate-800">
              <span className="mr-2 text-violet-500 text-base">#</span>
              이 집단이 추구하는 핵심 키워드 Top {keywordStats.length}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              빈도수와 중요도를 기반으로 정렬했습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {keywordStats.map((item, index) => {
              const rank = index + 1;
              const colors = [
                {
                  header: 'from-orange-500 to-red-500',
                  bar: 'bg-orange-400',
                  badge: 'bg-orange-50 text-orange-700',
                },
                {
                  header: 'from-indigo-500 to-purple-500',
                  bar: 'bg-indigo-400',
                  badge: 'bg-indigo-50 text-indigo-700',
                },
                {
                  header: 'from-emerald-500 to-green-500',
                  bar: 'bg-emerald-400',
                  badge: 'bg-emerald-50 text-emerald-700',
                },
                {
                  header: 'from-sky-500 to-blue-500',
                  bar: 'bg-sky-400',
                  badge: 'bg-sky-50 text-sky-700',
                },
                {
                  header: 'from-teal-500 to-emerald-500',
                  bar: 'bg-teal-400',
                  badge: 'bg-teal-50 text-teal-700',
                },
                {
                  header: 'from-amber-500 to-orange-500',
                  bar: 'bg-amber-400',
                  badge: 'bg-amber-50 text-amber-700',
                },
                {
                  header: 'from-lime-500 to-green-500',
                  bar: 'bg-lime-400',
                  badge: 'bg-lime-50 text-lime-700',
                },
                {
                  header: 'from-rose-500 to-pink-500',
                  bar: 'bg-rose-400',
                  badge: 'bg-rose-50 text-rose-700',
                },
              ];

              const color = colors[index % colors.length];
        
        return (
                <div
                  key={item.keyword}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col"
                >
                  {/* 상단 컬러 헤더 */}
                  <div className={`px-4 py-2 bg-gradient-to-r ${color.header} text-white flex items-center justify-between`}>
                    <div className="text-xs font-semibold">#{rank}</div>
                    <div className="text-[10px] opacity-90">상위 키워드</div>
            </div>

                  {/* 본문 */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900 mb-3">
                        {item.keyword}
              </div>

                      <div className="flex items-baseline justify-between mb-1.5">
                        <div className="text-[11px] text-slate-500">언급 패널</div>
                        <div className="text-base font-semibold text-slate-900">
                          {item.panelCount.toLocaleString()}명
              </div>
            </div>

                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[11px] text-slate-500">전체 대비</div>
                        <div className="text-xs font-semibold text-slate-700">
                          {item.ratio}%
              </div>
                      </div>

                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full ${color.bar}`}
                          style={{ width: `${Math.max(5, item.ratio)}%` }}
                        />
                      </div>
                    </div>

                    {/* 연관 키워드 간단 태그: 다른 주요 키워드들 중 상위 2~3개를 함께 보여줌 */}
                    <div>
                      <div className="text-[11px] text-slate-500 mb-1">연관 키워드</div>
                      <div className="flex flex-wrap gap-1.5">
                        {keywordStats
                          .filter((k) => k.keyword !== item.keyword)
                          .slice(0, 3)
                          .map((rel) => (
                            <span
                              key={rel.keyword}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${color.badge}`}
                            >
                              {rel.keyword}
                            </span>
                          ))}
                        {keywordStats.length <= 1 && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-500">
                            키워드 데이터 분석 중
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </section>
      )}

      {/* 키워드 연관성 분석 + 패턴 카드 */}
      {(keywordRelations.strong.length > 0 ||
        keywordRelations.medium.length > 0 ||
        keywordRelations.independent.length > 0) && (
        <section className="mb-10">
          {/* 키워드 연관성 분석 */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center">
                <span className="text-violet-600 text-xl">🔗</span>
          </div>
              <div>
                <h3 className="text-base md:text-lg font-semibold text-slate-900">
                  키워드 연관성 분석
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  키워드 간 동시 출현 빈도를 기반으로 연관 관계를 요약했습니다.
                </p>
              </div>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 강한 연관성 */}
              <div className="rounded-2xl border border-red-100 bg-red-50/60 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 text-lg">ɸ</span>
                    <span className="text-sm font-semibold text-red-800">
                      강한 연관성
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-red-900">
                  {keywordRelations.strong.length > 0 ? (
                    keywordRelations.strong.map((item) => (
                      <div key={`${item.pair[0]}-${item.pair[1]}`} className="flex items-center justify-between">
                        <span>
                          {item.pair[0]} ↔ {item.pair[1]}
                        </span>
                        <span className="font-semibold">
                          {Math.round(item.ratio * 100)}
                          %
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-red-700/70">
                      아직 강한 연관성이 감지된 키워드 쌍이 없습니다.
                    </p>
            )}
          </div>
              </div>

              {/* 중간 연관성 */}
              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sky-500 text-lg">◎</span>
                    <span className="text-sm font-semibold text-sky-800">
                      중간 연관성
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-sky-900">
                  {keywordRelations.medium.length > 0 ? (
                    keywordRelations.medium.map((item) => (
                      <div key={`${item.pair[0]}-${item.pair[1]}`} className="flex items-center justify-between">
                        <span>
                          {item.pair[0]} ↔ {item.pair[1]}
                        </span>
                        <span className="font-semibold">
                          {Math.round(item.ratio * 100)}
                          %
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-sky-700/70">
                      중간 수준의 연관성이 있는 키워드 쌍이 충분하지 않습니다.
                    </p>
                  )}
                </div>
              </div>

              {/* 독립적 키워드 */}
              <div className="rounded-2xl border border-purple-100 bg-purple-50/60 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-500 text-lg">✦</span>
                    <span className="text-sm font-semibold text-purple-900">
                      독립적 키워드
                    </span>
          </div>
                </div>
                <div className="space-y-1.5 text-xs text-purple-900">
                  {keywordRelations.independent.length > 0 ? (
                    keywordRelations.independent.map((item) => (
                      <div key={item.keyword} className="flex items-center justify-between">
                        <span>{item.keyword}</span>
                        <span className="font-semibold">
                          단독{' '}
                          {Math.round(item.soloRatio * 100)}
                          %
                  </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-purple-700/70">
                      다른 키워드와 분리된 독립적 키워드는 거의 없습니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 이런 패턴을 발견했습니다 */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <span className="text-emerald-600 text-xl">📈</span>
              </div>
              <div>
                <h3 className="text-base md:text-lg font-bold text-slate-900">
                  이런 패턴을 발견했습니다
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  AI가 분석한 공통점과 특이사항을 요약한 인사이트입니다.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 연령대 분포 카드 */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-5 py-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-slate-700 text-lg">👥</span>
                    <span className="text-sm font-semibold text-slate-900">
                      연령대 분포
                    </span>
                  </div>
                  {ageChartData.length > 0 ? (
                    (() => {
                      // 가장 많은 인원이 포함된 연령대 선택
                      const main = ageChartData.reduce(
                        (max, item) => (item.value > max.value ? item : max),
                        ageChartData[0],
                      );
                      const totalPanels = processed.length || totalCount || 1;
                      const ratio = Math.round(
                        ((main.value || 0) / totalPanels) * 100,
                      );
                      return (
                        <>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {main.name}가 전체의{' '}
                            <span className="text-violet-600 font-semibold">
                              {ratio}%
                            </span>
                            를 차지하며, 이 연령대에서 의미 기반 반응이 특히 많이
                            관측됩니다.
                          </p>
                          <p className="mt-2 text-[11px] text-violet-700 font-medium">
                            → {main.name} 타겟팅 캠페인에 특히 유리한 집단입니다.
                          </p>
                        </>
                      );
                    })()
                  ) : (
                    <p className="text-xs text-slate-500">
                      연령대 정보가 충분하지 않아 패턴을 도출하기 어렵습니다.
                    </p>
                  )}
                </div>
              </div>

              {/* 주요 증상/관심사 카드 */}
              <div className="rounded-2xl border border-pink-100 bg-pink-50/80 px-5 py-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-pink-500 text-lg">😥</span>
                    <span className="text-sm font-semibold text-pink-900">
                      주요 증상/관심사
                    </span>
                  </div>
                  {keywordStats.length > 0 ? (
                    (() => {
                      const topKeywords = keywordStats.slice(0, 3);
                      const ratioText = topKeywords
                        .map((k) => k.keyword)
                        .join(', ');
                      return (
                        <>
                          <p className="text-xs text-pink-900 leading-relaxed">
                            {ratioText}와(과) 같은 키워드가 응답의{' '}
                            <span className="font-semibold">
                              상당수에서 반복
                            </span>
                            되어 나타나, 이 집단의 핵심 고민으로 보입니다.
                          </p>
                          <p className="mt-2 text-[11px] text-pink-700 font-medium">
                            → 복합 증상 케어/관련 혜택 메시지에 높은 반응이
                            기대됩니다.
                          </p>
                        </>
                      );
                    })()
                  ) : (
                    <p className="text-xs text-pink-700/80">
                      키워드 통계가 부족해 주요 증상을 추출할 수 없습니다.
                    </p>
                  )}
                </div>
              </div>

              {/* 지역 특성 카드 */}
              <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-5 py-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-amber-500 text-lg">📍</span>
                    <span className="text-sm font-semibold text-amber-900">
                      지역 특성
                    </span>
                  </div>
                  {regionChartData.length > 0 ? (
                    (() => {
                      const main = regionChartData[0];
                      const totalPanels = processed.length || totalCount || 1;
                      const ratio = Math.round(
                        ((main.value || 0) / totalPanels) * 100,
                      );
                      return (
                        <>
                          <p className="text-xs text-amber-900 leading-relaxed">
                            {main.name} 거주자가 전체의{' '}
                            <span className="font-semibold text-amber-700">
                              {ratio}%
                            </span>
                            로, 해당 지역에서 의미 기반 조건에 부합하는 패널이
                            집중되어 있습니다.
                          </p>
                          <p className="mt-2 text-[11px] text-amber-700 font-medium">
                            → {main.name} 중심의 지역 타겟 캠페인을 우선적으로
                            고려할 수 있습니다.
                          </p>
                        </>
                      );
                    })()
                  ) : (
                    <p className="text-xs text-amber-800/80">
                      지역 정보가 부족해 특정 지역 패턴을 파악하기 어렵습니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 데이터 테이블 (정확한 조건 일치) */}
      <section className="mt-8 mb-10">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              데이터 테이블 (정확한 조건 일치)
            </h3>
            <button
              onClick={onDownloadExcel}
              className="flex items-center gap-2 px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-sm font-semibold transition-colors"
            >
              <Download size={16} />
              엑셀 다운로드
            </button>
          </div>
          
          <TableWithInfiniteScroll
            allResults={allResults.length > 0 ? allResults : (searchResult.unified?.results || [])}
            tableColumns={[
              { key: 'id', label: 'ID' },
              { key: 'gender', label: '성별' },
              { key: 'age', label: '나이' },
              { key: 'region', label: '지역' },
              { key: 'content', label: '특이사항' },
            ]}
            highlightFilter={null}
          />
        </div>
      </section>

    </div>
  );
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
      id: r.respondent_id || r.doc_id || r.id || `#${idx + 1}`,
      gender: r.gender || '-',
      age: r.age_text || r.age || '-',
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


