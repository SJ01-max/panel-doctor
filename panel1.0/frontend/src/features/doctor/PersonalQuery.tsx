import { useState, useEffect } from 'react';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Chip from '../../components/base/Chip';
import Badge from '../../components/base/Badge';

const EXAMPLE_QUERIES = [
  "요즘 피곤하고 햇빛을 못 쬐는데 뭐 먹으면 좋을까요?",
  "수면은 하루 5시간 정도 자고 있어요. 개선 방법이 있을까요?",
  "관절이 아프고 스트레스가 심해요. 영양제 추천해주세요.",
  "운동을 거의 안 하는데 필요한 영양소가 뭔가요?",
  "피부가 건조하고 탈모가 걱정돼요. 도움되는 영양제는?"
];

export default function PersonalQuery() {
  const [query, setQuery] = useState('');
  const [extractedSymptoms, setExtractedSymptoms] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [mode, setMode] = useState<'personal' | 'cohort'>('personal');
  const [isTyping, setIsTyping] = useState(false);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);

  // 실시간 증상 추출 미리보기
  useEffect(() => {
    if (!query.trim()) {
      setExtractedSymptoms([]);
      return;
    }

    const symptoms: string[] = [];
    const symptomKeywords: { [key: string]: string } = {
      '피곤': '피곤',
      '피로': '피곤',
      '햇빛': '햇빛 부족',
      '햇볕': '햇빛 부족',
      '수면': '수면 부족',
      '잠': '수면 부족',
      '스트레스': '스트레스',
      '관절': '관절통',
      '관절통': '관절통',
      '탈모': '탈모',
      '피부': '피부 건조',
      '건조': '피부 건조',
      '운동': '운동 부족',
      '활동': '운동 부족'
    };

    Object.keys(symptomKeywords).forEach(keyword => {
      if (query.includes(keyword) && !symptoms.includes(symptomKeywords[keyword])) {
        symptoms.push(symptomKeywords[keyword]);
      }
    });

    setExtractedSymptoms(symptoms);
  }, [query]);

  const handleQuerySubmit = () => {
    if (!query.trim()) return;
    
    setIsProcessing(true);
    if (!queryHistory.includes(query)) {
      setQueryHistory(prev => [query, ...prev.slice(0, 4)]);
    }
    
    // 증상 추출 시뮬레이션
    setTimeout(() => {
      setIsProcessing(false);
      setShowRecommendations(true);
    }, 2000);
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 500);
  };

  const removeSymptom = (index: number) => {
    setExtractedSymptoms(prev => prev.filter((_, i) => i !== index));
  };

  const recommendations = [
    {
      name: '비타민 D',
      dosage: '1000-2000 IU',
      timing: '아침 식후',
      reason: '햇빛 부족으로 인한 비타민 D 결핍 개선',
      caution: '칼슘 흡수 증가로 신장결석 주의',
      confidence: 92,
      icon: 'ri-sun-line'
    },
    {
      name: '마그네슘',
      dosage: '200-400mg',
      timing: '저녁 식후',
      reason: '피로 회복 및 근육 이완, 수면 질 개선',
      caution: '과다 복용 시 설사 가능',
      confidence: 88,
      icon: 'ri-flashlight-line'
    },
    {
      name: '비타민 B 복합체',
      dosage: '1정',
      timing: '아침 식후',
      reason: '에너지 대사 촉진 및 피로 개선',
      caution: '공복 복용 시 속쓰림 가능',
      confidence: 85,
      icon: 'ri-battery-charge-line'
    }
  ];

  const cohortOptions = [
    {
      id: 1,
      name: '서울/20대/남성/100명',
      summary: '수면부족 62% · 햇빛부족 71% · 스트레스 높음 45%',
      matchRate: 85
    },
    {
      id: 2,
      name: '전국/30대/직장인/250명',
      summary: '피로감 78% · 운동부족 83% · 영양불균형 56%',
      matchRate: 72
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 p-6 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#00C2A8] to-[#2F6BFF] bg-clip-text text-transparent">
            개인 건강 상담
          </h1>
          <p className="text-gray-600 mt-2 text-lg">증상이나 생활습관을 자연어로 입력하세요</p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-soft border border-gray-100">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">AI 상담사 준비됨</span>
        </div>
      </div>

      {/* 모드 선택 */}
      <Card className="animate-slide-up backdrop-blur-sm bg-white/90">
        <div className="flex items-center bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-1.5 w-fit shadow-inner">
          <button
            onClick={() => setMode('personal')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
              mode === 'personal' 
                ? 'bg-gradient-to-r from-[#00C2A8] to-[#00A693] text-white shadow-lg transform scale-105' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <i className="ri-user-line mr-2"></i>
            개인 질의
          </button>
          <button
            onClick={() => setMode('cohort')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
              mode === 'cohort' 
                ? 'bg-gradient-to-r from-[#00C2A8] to-[#00A693] text-white shadow-lg transform scale-105' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <i className="ri-group-line mr-2"></i>
            코호트 불러오기
          </button>
        </div>
      </Card>

      {mode === 'cohort' && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">코호트 선택</h2>
          <div className="space-y-3 mb-4">
            {cohortOptions.map((cohort) => (
              <div key={cohort.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{cohort.name}</h3>
                  <Badge variant="info">{cohort.matchRate}% 일치</Badge>
                </div>
                <p className="text-sm text-gray-600">{cohort.summary}</p>
              </div>
            ))}
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">가중치 설정</h3>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">개인 70%</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div className="bg-[#00C2A8] h-2 rounded-full" style={{ width: '70%' }}></div>
              </div>
              <span className="text-sm text-gray-600">코호트 30%</span>
            </div>
          </div>
        </Card>
      )}

      {/* 예시 질문 */}
      {!query && !showRecommendations && (
        <div className="animate-fade-in">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <i className="ri-lightbulb-line mr-2 text-yellow-500"></i>
            빠른 시작 - 예시 질문
          </h3>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example, idx) => (
              <button
                key={idx}
                onClick={() => handleExampleClick(example)}
                className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#00C2A8]/10 hover:to-[#2F6BFF]/10 hover:border-[#00C2A8] hover:text-[#00C2A8] transition-all duration-300 hover:shadow-md hover:scale-105"
              >
                <i className="ri-question-line mr-1.5"></i>
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 자연어 입력 */}
      <Card className={`animate-slide-up backdrop-blur-sm bg-white/90 transition-all duration-500 ${isTyping ? 'ring-2 ring-[#00C2A8] ring-opacity-50' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <i className="ri-chat-3-line mr-2 text-[#00C2A8]"></i>
            증상 및 생활습관 입력
          </h2>
          {queryHistory.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">최근 질문:</span>
              <select
                onChange={(e) => setQuery(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
              >
                <option value="">선택하세요</option>
                {queryHistory.map((q, idx) => (
                  <option key={idx} value={q}>{q.substring(0, 30)}...</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="relative">
          <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-2xl p-1 shadow-inner">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: 요즘 피곤하고 햇빛을 못 쬐는데 뭐 먹으면 좋을까요? 수면은 하루 5시간 정도 자고 있어요."
              className="w-full h-40 p-6 bg-white border-0 rounded-xl resize-none focus:ring-0 focus:outline-none text-gray-800 placeholder-gray-400 text-base"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  e.preventDefault();
                  handleQuerySubmit();
                }
              }}
              disabled={isProcessing}
            />
            <div className="absolute bottom-4 right-4 flex items-center gap-3">
              <div className="text-xs text-gray-400 bg-white/80 px-2 py-1 rounded-md backdrop-blur-sm">
                Ctrl + Enter로 전송
              </div>
              <button 
                className="p-3 text-gray-400 hover:text-[#00C2A8] rounded-xl hover:bg-[#00C2A8]/10 transition-all duration-300 hover:scale-110"
                title="음성 입력"
              >
                <i className="ri-mic-line text-xl"></i>
              </button>
              <Button 
                onClick={handleQuerySubmit} 
                disabled={!query.trim() || isProcessing}
                className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                {isProcessing ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    분석 중...
                  </>
                ) : (
                  <>
                    <i className="ri-stethoscope-line mr-2"></i>
                    상담 시작
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* 실시간 증상 추출 미리보기 */}
          {extractedSymptoms.length > 0 && !isProcessing && (
            <div className="mt-4 p-4 bg-gradient-to-r from-[#00C2A8]/10 to-[#2F6BFF]/10 rounded-xl border border-[#00C2A8]/20 animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-magic-line text-[#00C2A8]"></i>
                <span className="text-sm font-medium text-gray-700">실시간 인식된 증상/습관</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {extractedSymptoms.map((symptom, index) => (
                  <Chip 
                    key={index} 
                    variant="secondary"
                    className="bg-white/80 backdrop-blur-sm border border-[#00C2A8]/30 text-[#00C2A8]"
                  >
                    <i className="ri-check-line mr-1"></i>
                    {symptom}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 처리 중 애니메이션 */}
      {isProcessing && (
        <Card className="animate-fade-in backdrop-blur-sm bg-white/90">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-[#00C2A8]/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-[#00C2A8] rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="ri-stethoscope-line text-2xl text-[#00C2A8]"></i>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI가 증상을 분석하고 있습니다</h3>
            <p className="text-sm text-gray-600">잠시만 기다려주세요...</p>
            <div className="mt-4 w-64 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#00C2A8] to-[#2F6BFF] rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        </Card>
      )}

      {/* 추천 결과 */}
      {showRecommendations && (
        <div className="space-y-6 animate-fade-in">
          <Card className="backdrop-blur-sm bg-white/90">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <i className="ri-medicine-bottle-line mr-2 text-[#00C2A8]"></i>
                  맞춤 영양제 추천
                </h2>
                <p className="text-sm text-gray-600 mt-1">AI가 분석한 최적의 영양제입니다</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info" className="bg-gradient-to-r from-[#00C2A8] to-[#00A693] text-white border-0">
                  개인 70%
                </Badge>
                {mode === 'cohort' && (
                  <Badge variant="neutral" className="bg-gradient-to-r from-[#2F6BFF] to-[#1E4FCC] text-white border-0">
                    코호트 30%
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recommendations.map((rec, index) => (
                <div 
                  key={index} 
                  className="group relative border border-gray-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm animate-slide-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* 신뢰도 배지 */}
                  <div className="absolute top-4 right-4">
                    <div className="relative w-16 h-16">
                      <svg className="transform -rotate-90 w-16 h-16">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          className="text-gray-200"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 28}`}
                          strokeDashoffset={`${2 * Math.PI * 28 * (1 - rec.confidence / 100)}`}
                          className="text-[#00C2A8] transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-[#00C2A8]">{rec.confidence}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#00C2A8]/20 to-[#2F6BFF]/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <i className={`${rec.icon} text-[#00C2A8] text-2xl`}></i>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{rec.name}</h3>
                      <p className="text-xs text-gray-500">신뢰도 {rec.confidence}%</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-4 bg-white/60 rounded-xl p-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 flex items-center">
                        <i className="ri-capsule-line mr-2 text-[#00C2A8]"></i>
                        권장 용량
                      </span>
                      <span className="font-semibold text-gray-900">{rec.dosage}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 flex items-center">
                        <i className="ri-time-line mr-2 text-[#00C2A8]"></i>
                        복용 시점
                      </span>
                      <span className="font-semibold text-gray-900">{rec.timing}</span>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-[#00C2A8]/10 to-[#2F6BFF]/10 rounded-xl p-3 mb-4 border border-[#00C2A8]/20">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      <i className="ri-information-line mr-1 text-[#00C2A8]"></i>
                      {rec.reason}
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-3 mb-4">
                    <p className="text-xs text-yellow-800 flex items-start">
                      <i className="ri-alert-line mr-1.5 mt-0.5 text-yellow-600"></i>
                      <span>{rec.caution}</span>
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1 bg-gradient-to-r from-[#00C2A8] to-[#00A693] hover:from-[#00A693] hover:to-[#008F7A] shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      <i className="ri-add-circle-line mr-1.5"></i>
                      플랜 담기
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="hover:bg-gray-100 transition-all duration-300"
                    >
                      <i className="ri-refresh-line mr-1.5"></i>
                      대안
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 생활습관 가이드 */}
          <Card className="backdrop-blur-sm bg-white/90 animate-slide-up">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <i className="ri-lightbulb-flash-line mr-2 text-yellow-500"></i>
              추가 생활습관 가이드
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="group relative bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 hover:shadow-lg transition-all duration-300 hover:scale-105 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/20 rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                    <i className="ri-sun-line text-white text-xl"></i>
                  </div>
                  <h3 className="font-semibold text-green-800 mb-2 text-lg">햇빛 노출</h3>
                  <p className="text-sm text-green-700 leading-relaxed">
                    하루 15-30분 야외 활동으로 자연스러운 비타민 D 합성을 도와보세요.
                  </p>
                </div>
              </div>
              <div className="group relative bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 hover:shadow-lg transition-all duration-300 hover:scale-105 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                    <i className="ri-moon-line text-white text-xl"></i>
                  </div>
                  <h3 className="font-semibold text-blue-800 mb-2 text-lg">수면 개선</h3>
                  <p className="text-sm text-blue-700 leading-relaxed">
                    규칙적인 수면 패턴과 7-8시간 충분한 수면을 취하시기 바랍니다.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* 새 질문 버튼 */}
          <div className="flex justify-center animate-fade-in">
            <Button
              onClick={() => {
                setQuery('');
                setShowRecommendations(false);
                setExtractedSymptoms([]);
              }}
              variant="secondary"
              className="bg-white/80 backdrop-blur-sm hover:bg-white shadow-md"
            >
              <i className="ri-add-line mr-2"></i>
              새로운 질문하기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
