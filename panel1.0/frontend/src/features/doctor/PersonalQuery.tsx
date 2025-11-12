import { useState } from 'react';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Chip from '../../components/base/Chip';
import Badge from '../../components/base/Badge';

export default function PersonalQuery() {
  const [query, setQuery] = useState('');
  const [extractedSymptoms, setExtractedSymptoms] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [mode, setMode] = useState<'personal' | 'cohort'>('personal');

  const handleQuerySubmit = () => {
    if (!query.trim()) return;
    
    setIsProcessing(true);
    
    // 증상 추출 시뮬레이션
    setTimeout(() => {
      const symptoms = [];
      if (query.includes('피곤')) symptoms.push('피곤');
      if (query.includes('햇빛')) symptoms.push('햇빛 부족');
      if (query.includes('수면')) symptoms.push('수면 부족');
      if (query.includes('스트레스')) symptoms.push('스트레스');
      if (query.includes('관절')) symptoms.push('관절통');
      
      setExtractedSymptoms(symptoms);
      setIsProcessing(false);
      setShowRecommendations(true);
    }, 2000);
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
    <div className="p-6 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">개인 건강 상담</h1>
          <p className="text-gray-600 mt-1">증상이나 생활습관을 자연어로 입력하세요</p>
        </div>
      </div>

      {/* 모드 선택 */}
      <Card>
        <div className="flex items-center bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setMode('personal')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              mode === 'personal' 
                ? 'bg-white text-[#00C2A8] shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            개인 질의
          </button>
          <button
            onClick={() => setMode('cohort')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              mode === 'cohort' 
                ? 'bg-white text-[#00C2A8] shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
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

      {/* 자연어 입력 */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">증상 및 생활습관 입력</h2>
        
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 요즘 피곤하고 햇빛을 못 쬐는데 뭐 먹으면 좋을까요? 수면은 하루 5시간 정도 자고 있어요."
            className="w-full h-32 p-4 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-[#00C2A8] focus:border-transparent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleQuerySubmit();
              }
            }}
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <i className="ri-mic-line text-lg"></i>
            </button>
            <Button onClick={handleQuerySubmit} disabled={!query.trim() || isProcessing}>
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
      </Card>

      {/* 추출된 증상 */}
      {extractedSymptoms.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">인식된 증상/습관</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {extractedSymptoms.map((symptom, index) => (
              <Chip 
                key={index} 
                variant="secondary"
                onRemove={() => removeSymptom(index)}
              >
                {symptom}
              </Chip>
            ))}
          </div>
          <p className="text-sm text-gray-600">
            <i className="ri-information-line mr-1"></i>
            증상이 정확하지 않다면 수정하거나 제거해주세요
          </p>
        </Card>
      )}

      {/* 추천 결과 */}
      {showRecommendations && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">맞춤 영양제 추천</h2>
              <div className="flex items-center gap-2">
                <Badge variant="info">개인 70%</Badge>
                {mode === 'cohort' && <Badge variant="neutral">코호트 30%</Badge>}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendations.map((rec, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#00C2A8]/10 rounded-lg flex items-center justify-center">
                      <i className={`${rec.icon} text-[#00C2A8] text-lg`}></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{rec.name}</h3>
                      <div className="flex items-center gap-1">
                        <div className="w-16 bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-[#00C2A8] h-1 rounded-full" 
                            style={{ width: `${rec.confidence}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500">{rec.confidence}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">권장 용량:</span>
                      <span className="font-medium">{rec.dosage}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">복용 시점:</span>
                      <span className="font-medium">{rec.timing}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-3">{rec.reason}</p>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-4">
                    <p className="text-xs text-yellow-800">
                      <i className="ri-alert-line mr-1"></i>
                      {rec.caution}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1">플랜 담기</Button>
                    <Button variant="secondary" size="sm">대안 보기</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 생활습관 가이드 */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">추가 생활습관 가이드</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-800 mb-2">
                  <i className="ri-sun-line mr-2"></i>햇빛 노출
                </h3>
                <p className="text-sm text-green-700">
                  하루 15-30분 야외 활동으로 자연스러운 비타민 D 합성을 도와보세요.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">
                  <i className="ri-moon-line mr-2"></i>수면 개선
                </h3>
                <p className="text-sm text-blue-700">
                  규칙적인 수면 패턴과 7-8시간 충분한 수면을 취하시기 바랍니다.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
