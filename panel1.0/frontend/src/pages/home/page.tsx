
import { useNavigate } from 'react-router-dom';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';

export default function Home() {
  const navigate = useNavigate();

  const features = [
    {
      title: '기업용 패널 추출',
      description: '자연어로 패널 데이터를 검색하고 추출하세요',
      icon: 'ri-search-2-line',
      color: '#2F6BFF',
      path: '/?tab=panel'
    },
    {
      title: 'AI 닥터 추천',
      description: '개인 맞춤 건강 상담 및 영양제 추천',
      icon: 'ri-stethoscope-line',
      color: '#00C2A8',
      path: '/?tab=doctor'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#2F6BFF] rounded-lg flex items-center justify-center">
                <i className="ri-dashboard-3-line text-white text-xl"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: '"Pacifico", serif' }}>
                Panel Doctor Dashboard
              </h1>
            </div>
            <Button onClick={() => navigate('/')}>
              대시보드 시작하기
            </Button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* 히어로 섹션 */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            자연어 기반 패널 검색과<br />
            <span className="text-[#00C2A8]">AI 닥터 추천</span>을 한번에
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            기업의 패널 데이터 추출부터 개인 맞춤 건강 상담까지,
            하나의 플랫폼에서 모든 것을 해결하세요
          </p>
          <Button size="lg" onClick={() => navigate('/')}>
            <i className="ri-rocket-line mr-2"></i>
            지금 시작하기
          </Button>
        </div>

        {/* 기능 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(feature.path)}>
              <div 
                className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ backgroundColor: `${feature.color}20` }}
              >
                <i className={`${feature.icon} text-3xl`} style={{ color: feature.color }}></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
              <p className="text-gray-600 mb-6">{feature.description}</p>
              <Button 
                variant="secondary" 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(feature.path);
                }}
              >
                자세히 보기
              </Button>
            </Card>
          ))}
        </div>

        {/* 특징 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-[#2F6BFF]/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <i className="ri-brain-line text-[#2F6BFF] text-xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">자연어 처리</h3>
            <p className="text-gray-600">복잡한 쿼리 없이 일상 언어로 데이터를 검색하세요</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-[#00C2A8]/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <i className="ri-user-heart-line text-[#00C2A8] text-xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">개인 맞춤 추천</h3>
            <p className="text-gray-600">AI 기반 개인별 건강 상태 분석 및 맞춤 솔루션</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-[#FFC757]/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <i className="ri-dashboard-line text-[#FFC757] text-xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">통합 대시보드</h3>
            <p className="text-gray-600">모든 기능을 하나의 직관적인 인터페이스에서</p>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center">
                <i className="ri-dashboard-3-line text-white text-lg"></i>
              </div>
              <span className="font-semibold text-gray-900">Panel Doctor Dashboard</span>
            </div>
            <div className="text-sm text-gray-600">
              © 2024 Panel Doctor Dashboard. 
              <a href="https://readdy.ai/?origin=logo" className="ml-2 text-[#2F6BFF] hover:underline">
                Powered by Readdy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
