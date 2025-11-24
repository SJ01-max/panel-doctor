import React, { useEffect } from 'react';
import { X, Calendar, MapPin, User } from 'lucide-react';
import { mockPanelDetails, type PanelDetail } from '../../../utils/mockPanelData';

interface PanelDetailSlideOverProps {
  panelId: string | null;
  panelData?: {
    id: string;
    gender: string;
    age: string;
    region: string;
  } | null;
  onClose: () => void;
}

export const PanelDetailSlideOver: React.FC<PanelDetailSlideOverProps> = ({
  panelId,
  panelData,
  onClose
}) => {
  // mockPanelDetails에서 찾거나, panelData로부터 기본 정보 생성
  const mockPanel = panelId ? mockPanelDetails[panelId] : null;
  
  // mockPanel이 없으면 panelData로부터 기본 패널 정보 생성
  const panel: PanelDetail | null = mockPanel || (panelData ? {
    id: panelData.id,
    gender: panelData.gender,
    age: panelData.age,
    birthYear: panelData.age.includes('만') 
      ? (() => {
          const ageMatch = panelData.age.match(/만\s*(\d+)세/);
          if (ageMatch) {
            const age = parseInt(ageMatch[1]);
            const currentYear = new Date().getFullYear();
            return `${currentYear - age}년생`;
          }
          return '';
        })()
      : '',
    region: panelData.region,
    lastResponseDate: new Date().toISOString().split('T')[0],
    surveys: [
      {
        id: 'survey_001',
        title: '기본 정보 설문',
        date: new Date().toISOString().split('T')[0],
        responses: [
          { question: '성별', answer: panelData.gender },
          { question: '연령', answer: panelData.age },
          { question: '지역', answer: panelData.region }
        ]
      },
      {
        id: 'survey_002',
        title: '라이프스타일 설문',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        responses: [
          { question: '주요 관심사', answer: '건강, 운동' },
          { question: '일상 활동', answer: '규칙적인 생활' },
          { question: '취미 활동', answer: '다양한 활동 참여' }
        ]
      },
      {
        id: 'survey_003',
        title: '소비 패턴 설문',
        date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        responses: [
          { question: '주요 소비 카테고리', answer: '생활 필수품' },
          { question: '온라인 쇼핑 빈도', answer: '주 1-2회' },
          { question: '브랜드 선호도', answer: '중간' }
        ]
      },
      {
        id: 'survey_004',
        title: '디지털 사용 현황',
        date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        responses: [
          { question: '스마트폰 사용', answer: '일상 필수' },
          { question: '주요 앱', answer: '소셜미디어, 쇼핑' },
          { question: '디지털 적응도', answer: '보통' }
        ]
      },
      {
        id: 'survey_005',
        title: '건강 관리 설문',
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        responses: [
          { question: '건강 관리 관심도', answer: '높음' },
          { question: '운동 빈도', answer: '주 1-2회' },
          { question: '건강 검진', answer: '정기적으로' }
        ]
      }
    ],
    aiSummary: `이 패널은 ${panelData.region}에 거주하는 ${panelData.gender}성 ${panelData.age}입니다. 추가 정보는 데이터베이스에서 확인할 수 있습니다.`
  } : null);

  useEffect(() => {
    if (panelId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [panelId]);

  if (!panelId || !panel) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide Over Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out"
        style={{ transform: panelId ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#7c5cff] via-[#6b7dff] to-[#5bc3ff] px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <User size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-base">패널 상세 정보</h2>
                <p className="text-xs text-white/80">{panel.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/20"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Profile Section */}
            <div className="bg-gradient-to-br from-violet-50 to-white rounded-2xl p-5 border border-violet-100">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold">
                  {panel.gender === '남' ? '👨' : '👩'}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {panel.gender} · {panel.age} ({panel.birthYear})
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <MapPin size={14} className="text-indigo-500" />
                      <span>{panel.region}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={14} className="text-violet-500" />
                      <span>최근 응답: {panel.lastResponseDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h4 className="text-sm font-semibold text-gray-800 mb-4">기본 정보</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">성별</span>
                  <p className="text-sm font-medium text-gray-900 mt-1">{panel.gender}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">연령</span>
                  <p className="text-sm font-medium text-gray-900 mt-1">{panel.age} ({panel.birthYear})</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">지역</span>
                  <p className="text-sm font-medium text-gray-900 mt-1">{panel.region}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">최근 응답일</span>
                  <p className="text-sm font-medium text-gray-900 mt-1">{panel.lastResponseDate}</p>
                </div>
              </div>
            </div>

            {/* Survey List */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h4 className="text-sm font-semibold text-gray-800 mb-4">
                참여한 설문 목록 ({panel.surveys.length}개)
              </h4>
              <div className="space-y-3">
                {panel.surveys.map((survey, idx) => (
                  <div
                    key={survey.id}
                    className="border border-gray-100 rounded-xl p-4 hover:border-violet-200 hover:bg-violet-50/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-sm font-medium text-gray-900">{survey.title}</h5>
                      <span className="text-[10px] text-gray-400">{survey.date}</span>
                    </div>
                    <div className="space-y-2 mt-3">
                      {survey.responses.slice(0, 3).map((response, rIdx) => (
                        <div key={rIdx} className="text-xs">
                          <span className="text-gray-500">{response.question}:</span>
                          <span className="text-gray-800 font-medium ml-2">{response.answer}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Summary */}
            <div className="bg-[#f3f6ff] rounded-2xl border border-[#e0e4ff] p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#7c5cff] text-lg">🧠</span>
                <h4 className="text-sm font-semibold text-gray-800">AI 자동 요약</h4>
              </div>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                {panel.aiSummary}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

