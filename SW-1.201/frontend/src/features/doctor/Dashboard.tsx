import Card from '../../components/base/Card';
import Badge from '../../components/base/Badge';

export default function DoctorDashboard() {
  const kpiData = [
    { title: '총 상담 건수', value: '1,247건', change: '+12.3%', icon: 'ri-chat-3-line', color: '#00C2A8' },
    { title: '오늘 추천 건수', value: '89건', change: '+8.7%', icon: 'ri-medicine-bottle-line', color: '#2F6BFF' },
    { title: '평균 만족도', value: '4.6/5.0', change: '+0.2', icon: 'ri-star-line', color: '#FFC757' },
    { title: '코호트 활용률', value: '73.2%', change: '+5.1%', icon: 'ri-group-line', color: '#18C08F' }
  ];

  const recentConsultations = [
    {
      id: 1,
      query: '요즘 피곤하고 햇빛을 못 쬐는데 뭐 먹으면 좋을까요?',
      symptoms: ['피곤', '햇빛 부족', '수면 부족'],
      recommendations: ['비타민 D', '마그네슘', '비타민 B군'],
      satisfaction: 4.8,
      time: '10분 전',
      cohortUsed: false
    },
    {
      id: 2,
      query: '관절이 아프고 염증이 있는 것 같아요',
      symptoms: ['관절통', '염증', '운동 부족'],
      recommendations: ['오메가-3', '글루코사민', '커큐민'],
      satisfaction: 4.5,
      time: '1시간 전',
      cohortUsed: true
    },
    {
      id: 3,
      query: '스트레스가 많고 잠이 안 와요',
      symptoms: ['스트레스', '불면', '집중력 저하'],
      recommendations: ['마그네슘', '테아닌', '멜라토닌'],
      satisfaction: 4.9,
      time: '2시간 전',
      cohortUsed: false
    }
  ];

  const popularSupplements = [
    { name: '비타민 D', count: 156, trend: '+15%' },
    { name: '오메가-3', count: 134, trend: '+8%' },
    { name: '마그네슘', count: 98, trend: '+22%' },
    { name: '비타민 B군', count: 87, trend: '+5%' },
    { name: '프로바이오틱스', count: 76, trend: '+18%' }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI 닥터 대시보드</h1>
          <p className="text-gray-600 mt-1">개인 맞춤 건강 상담 및 영양제 추천 현황</p>
        </div>
        <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
          <i className="ri-question-line text-lg"></i>
        </button>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((kpi, index) => (
          <Card key={index} className="relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{kpi.title}</p>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className={`text-sm mt-1 ${kpi.change.startsWith('+') ? 'text-[#18C08F]' : 'text-[#FF5A5A]'}`}>
                  {kpi.change} 전일 대비
                </p>
              </div>
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${kpi.color}20` }}
              >
                <i className={`${kpi.icon} text-xl`} style={{ color: kpi.color }}></i>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 최근 상담 내역 */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">최근 상담 내역</h2>
            <button className="text-[#00C2A8] text-sm font-medium hover:underline">
              전체 보기
            </button>
          </div>
          
          <div className="space-y-4">
            {recentConsultations.map((consultation) => (
              <div key={consultation.id} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium mb-2 text-sm">{consultation.query}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {consultation.symptoms.map((symptom, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 bg-[#00C2A8]/10 text-[#00C2A8] rounded-full text-xs"
                        >
                          {symptom}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {consultation.recommendations.map((rec, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs"
                        >
                          {rec}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {consultation.cohortUsed && (
                      <Badge variant="info">코호트</Badge>
                    )}
                    <div className="flex items-center gap-1">
                      <i className="ri-star-fill text-[#FFC757] text-sm"></i>
                      <span className="text-sm font-medium">{consultation.satisfaction}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500">
                  {consultation.time}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 인기 영양제 */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">인기 영양제 TOP 5</h2>
            <span className="text-sm text-gray-500">이번 주 기준</span>
          </div>
          
          <div className="space-y-3">
            {popularSupplements.map((supplement, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#00C2A8] rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <span className="font-medium text-gray-900">{supplement.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{supplement.count}회</div>
                  <div className="text-xs text-[#18C08F]">{supplement.trend}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 주의사항 배너 */}
      <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <i className="ri-alert-line text-orange-600 text-lg"></i>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">의료행위 안내</h3>
            <p className="text-sm text-gray-700">
              본 서비스는 의료행위가 아닌 건강 참고용 가이드입니다. 
              질병이 의심되거나 증상이 지속될 경우 전문의와 상담하시기 바랍니다.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
