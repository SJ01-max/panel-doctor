import React, { useState } from 'react';
import { X, MapPin, User, ChevronDown, ChevronUp, Download, Users, Plus } from 'lucide-react';
import { getPanelDetail, type PanelDetailData } from '../../api/panel';
import apiClient from '../../lib/api/client';

// ============================================
// Types
// ============================================

interface PanelDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  panelId: string | null;
}

interface PanelDetailResponse {
  respondent_id: string;
  age: number;
  birth_year: number;
  gender: 'M' | 'F' | null;
  region: string;
  interests?: string[];
  similarity_score?: number;
  highlight?: string[];
  answers?: Array<{
    question_id: string;
    question: string;
    answer: string;
  }>;
  // 기존 API 응답 필드도 포함
  age_text?: string | null;
  district?: string | null;
  json_doc?: any;
  last_response_date?: string | null;
}

// ============================================
// Sub Components
// ============================================

// Drawer Header
const DrawerHeader: React.FC<{ panelId: string; onClose: () => void }> = ({ panelId, onClose }) => (
  <div className="bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 px-6 py-4 flex items-center justify-between flex-shrink-0">
    <div className="flex items-center gap-3 text-white">
      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
        <User size={20} />
      </div>
      <div>
        <h2 className="font-semibold text-base">패널 상세 정보</h2>
        <p className="text-xs text-white/80">{panelId}</p>
      </div>
    </div>
    <button
      onClick={onClose}
      className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/20"
    >
      <X size={20} />
    </button>
  </div>
);

// 상단 프로필 요약 카드
const ProfileSummaryCard: React.FC<{
  gender: string | null;
  age: number | null;
  ageText: string | null;
  birthYear: number | null;
  region: string;
  district?: string | null;
}> = ({ gender, age, ageText, birthYear, region, district }) => {
  const genderText = gender === 'M' ? '남' : gender === 'F' ? '여' : '-';
  const ageDisplay = ageText || (age ? `만 ${age}세` : '-');
  const birthYearText = birthYear ? `(${birthYear}년생)` : '';
  const fullRegion = district ? `${region} ${district}` : region;

  return (
    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl p-6 border border-violet-100">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold">
          {gender === 'M' ? '👨' : gender === 'F' ? '👩' : '👤'}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {genderText} · {ageDisplay} {birthYearText}
          </h3>
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <MapPin size={14} className="text-indigo-500" />
            <span>{fullRegion}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 검색 조건과의 일치율 (semantic 검색일 경우만)
const SimilarityCard: React.FC<{
  similarityScore?: number;
  highlights?: string[];
}> = ({ similarityScore, highlights }) => {
  if (similarityScore === undefined) return null;

  const scorePercent = Math.round(similarityScore * 100);
  const scoreColor =
    scorePercent >= 90 ? 'text-green-600 bg-green-50 border-green-200' :
    scorePercent >= 80 ? 'text-violet-600 bg-violet-50 border-violet-200' :
    scorePercent >= 70 ? 'text-blue-600 bg-blue-50 border-blue-200' :
    'text-gray-600 bg-gray-50 border-gray-200';

  // 인구통계 정보 필터링 (성별, 나이, 지역, 출생년도 등)
  const filteredHighlights = React.useMemo(() => {
    if (!highlights || highlights.length === 0) return [];
    
    // 인구통계 정보 패턴
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
      /경기|서울|부산|대구|인천|광주|대전|울산|강원|충북|충남|전북|전남|경북|경남|제주/i,
    ];
    
    return highlights.filter(highlight => {
      const trimmed = highlight.trim();
      // 인구통계 패턴과 일치하는지 확인
      const isDemographic = demographicPatterns.some(pattern => pattern.test(trimmed));
      // "성별:", "나이:", "지역:" 같은 형식도 제외
      if (isDemographic) return false;
      // 너무 짧은 항목 제외 (2글자 이하)
      if (trimmed.length <= 2) return false;
      return true;
    });
  }, [highlights]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">검색 의도와의 일치율</span>
        </div>
        <span className={`px-4 py-2 rounded-lg text-lg font-bold border ${scoreColor}`}>
          {scorePercent}%
        </span>
      </div>
      {filteredHighlights && filteredHighlights.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            매칭 근거
          </div>
          <ul className="space-y-2">
            {filteredHighlights.map((highlight, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-violet-500 mt-1">•</span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// 기본 정보 Section
const BasicInfoSection: React.FC<{
  gender: string | null;
  age: number | null;
  ageText: string | null;
  birthYear: number | null;
  region: string;
  district?: string | null;
}> = ({ gender, age, ageText, birthYear, region, district }) => {
  const genderText = gender === 'M' ? '남' : gender === 'F' ? '여' : '-';
  const ageDisplay = ageText || (age ? `만 ${age}세` : '-');
  const birthYearText = birthYear ? `${birthYear}년생` : '-';
  const fullRegion = district ? `${region} ${district}` : region;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-800 mb-4">기본 정보</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-xs text-gray-500">성별</span>
          <p className="text-sm font-medium text-gray-900 mt-1">{genderText}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500">연령</span>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {ageDisplay} {birthYear !== null && `(${birthYearText})`}
          </p>
        </div>
        <div className="col-span-2">
          <span className="text-xs text-gray-500">지역</span>
          <p className="text-sm font-medium text-gray-900 mt-1">{fullRegion}</p>
        </div>
      </div>
    </div>
  );
};

// 관심사/라이프스타일 Section
const InterestsSection: React.FC<{ interests?: string[] }> = ({ interests }) => {
  if (!interests || interests.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h4 className="text-sm font-semibold text-gray-800 mb-4">관심사/라이프스타일</h4>
        <p className="text-sm text-gray-500">관심사 정보 없음</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-800 mb-4">관심사/라이프스타일</h4>
      <div className="flex flex-wrap gap-2">
        {interests.map((interest, idx) => (
          <span
            key={idx}
            className="px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-xs font-medium border border-violet-200"
          >
            {interest}
          </span>
        ))}
      </div>
    </div>
  );
};

// 주요 인사이트 Section (Placeholder)
const InsightsSection: React.FC<{ panelData: PanelDetailResponse }> = ({ panelData }) => {
  // TODO: AI 기반 인사이트 생성 로직 구현
  const insightText = "이 패널은 패션/카페 관심도가 높으며, 신제품 구매 빈도가 높은 그룹에 속합니다.";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-800 mb-4">주요 인사이트</h4>
      <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
        <p className="text-sm text-gray-700 leading-relaxed">{insightText}</p>
      </div>
    </div>
  );
};

// 응답 상세 Section (아코디언)
const AnswersSection: React.FC<{
  answers?: Array<{ question_id: string; question: string; answer: string }>;
}> = ({ answers }) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  if (!answers || answers.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h4 className="text-sm font-semibold text-gray-800 mb-4">응답 상세</h4>
        <p className="text-sm text-gray-500">응답 정보 없음</p>
      </div>
    );
  }

  // question_id 기준으로 그룹화 (예: "Q1", "Q2" 등)
  const groupedAnswers = answers.reduce((acc, answer) => {
    const groupKey = answer.question_id.split('_')[0] || '기타';
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(answer);
    return acc;
  }, {} as Record<string, typeof answers>);

  // 그룹 키를 정렬 (question_id 오름차순)
  const sortedGroups = Object.entries(groupedAnswers).sort(([a], [b]) => {
    const aNum = parseInt(a.replace(/\D/g, '')) || 0;
    const bNum = parseInt(b.replace(/\D/g, '')) || 0;
    return aNum - bNum;
  });

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-800 mb-4">응답 상세</h4>
      <div className="space-y-2">
        {sortedGroups.map(([groupKey, groupAnswers]) => {
          const isExpanded = expandedGroups.has(groupKey);
          return (
            <div key={groupKey} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleGroup(groupKey)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900">
                  {groupKey} ({groupAnswers.length}개 문항)
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              {isExpanded && (
                <div className="p-4 space-y-3 border-t border-gray-200">
                  {groupAnswers.map((answer, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="text-xs font-medium text-gray-600">{answer.question}</div>
                      <div className="text-sm text-gray-900">{answer.answer}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 하단 Action Buttons
const ActionButtons: React.FC<{
  onAddToTargetGroup: () => void;
  onShowSimilarPanels: () => void;
  onExportCSV: () => void;
}> = ({ onAddToTargetGroup, onShowSimilarPanels, onExportCSV }) => (
  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
    <button
      onClick={onAddToTargetGroup}
      className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white hover:bg-purple-700 rounded-xl px-4 py-2 transition-colors font-medium"
    >
      <Plus size={16} />
      타겟 그룹에 추가하기
    </button>
    <button
      onClick={onShowSimilarPanels}
      className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl px-4 py-2 transition-colors font-medium"
    >
      <Users size={16} />
      유사 패널 더보기
    </button>
    <button
      onClick={onExportCSV}
      className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl px-4 py-2 transition-colors font-medium"
    >
      <Download size={16} />
      CSV로 내보내기
    </button>
  </div>
);

// ============================================
// Main Component
// ============================================

export const PanelDetailDrawer: React.FC<PanelDetailDrawerProps> = ({
  isOpen,
  onClose,
  panelId
}) => {
  const [panelData, setPanelData] = useState<PanelDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 패널 데이터 가져오기
  React.useEffect(() => {
    if (!isOpen || !panelId) {
      setPanelData(null);
      return;
    }

    const fetchPanelDetail = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 기존 API 사용 (getPanelDetail)
        const data = await getPanelDetail(panelId);
        
        // 응답 형식을 PanelDetailResponse로 변환
        const transformedData: PanelDetailResponse = {
          respondent_id: data.respondent_id,
          age: data.age || 0,
          birth_year: data.birth_year || 0,
          gender: data.gender === '남' ? 'M' : data.gender === '여' ? 'F' : null,
          region: data.region || '',
          age_text: data.age_text,
          district: data.district,
          json_doc: data.json_doc,
          last_response_date: data.last_response_date,
          // TODO: 백엔드에서 similarity_score, highlight, answers, interests 제공 시 추가
          // similarity_score: data.similarity_score,
          // highlight: data.highlight,
          // answers: data.answers,
          // interests: data.interests,
        };

        setPanelData(transformedData);
      } catch (err: any) {
        console.error('패널 상세 정보 조회 실패:', err);
        setError(err?.message || '패널 상세 정보를 불러올 수 없습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPanelDetail();
  }, [isOpen, panelId]);

  // Body overflow 제어
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Action Handlers
  const handleAddToTargetGroup = () => {
    // TODO: 타겟 그룹 추가 로직 구현
    console.log('타겟 그룹에 추가:', panelId);
  };

  const handleShowSimilarPanels = () => {
    // TODO: 유사 패널 검색 로직 구현
    console.log('유사 패널 더보기:', panelId);
  };

  const handleExportCSV = () => {
    // TODO: CSV 내보내기 로직 구현
    console.log('CSV 내보내기:', panelId);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Header */}
          {panelId && <DrawerHeader panelId={panelId} onClose={onClose} />}

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
                  <p className="text-sm text-gray-500">패널 정보를 불러오는 중...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {!isLoading && !error && panelData && (
              <>
                {/* 상단 프로필 요약 카드 */}
                <ProfileSummaryCard
                  gender={panelData.gender}
                  age={panelData.age}
                  ageText={panelData.age_text || null}
                  birthYear={panelData.birth_year}
                  region={panelData.region}
                  district={panelData.district}
                />

                {/* 검색 조건과의 일치율 (semantic 검색일 경우만) */}
                {panelData.similarity_score !== undefined && (
                  <SimilarityCard
                    similarityScore={panelData.similarity_score}
                    highlights={panelData.highlight}
                  />
                )}

                {/* 기본 정보 Section */}
                <BasicInfoSection
                  gender={panelData.gender}
                  age={panelData.age}
                  ageText={panelData.age_text || null}
                  birthYear={panelData.birth_year}
                  region={panelData.region}
                  district={panelData.district}
                />

                {/* 관심사/라이프스타일 Section */}
                <InterestsSection interests={panelData.interests} />

                {/* 주요 인사이트 Section */}
                <InsightsSection panelData={panelData} />

                {/* 응답 상세 Section */}
                <AnswersSection answers={panelData.answers} />

                {/* 하단 Action Buttons */}
                <ActionButtons
                  onAddToTargetGroup={handleAddToTargetGroup}
                  onShowSimilarPanels={handleShowSimilarPanels}
                  onExportCSV={handleExportCSV}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};





