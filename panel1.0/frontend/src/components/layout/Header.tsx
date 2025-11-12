// 1. page.tsx에서 전달하는 props를 받도록 타입을 정의합니다.
interface HeaderProps {
  activeTab: 'panel' | 'doctor';
  onTabChange: (tab: 'panel' | 'doctor') => void;
  // (필요시) 사용자 정보 등 다른 props 추가
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  
  const getTabClass = (tabName: 'panel' | 'doctor') => {
    return activeTab === tabName
      ? "border-b-2 border-[#2F6BFF] text-[#2F6BFF] font-semibold" // 활성 탭
      : "border-b-2 border-transparent text-gray-500 hover:text-gray-900"; // 비활성 탭
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* 로고 및 탭 */}
          <div className="flex items-center gap-10">
            {/* 로고 */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#2F6BFF] rounded-lg flex items-center justify-center">
                <i className="ri-dashboard-3-line text-white text-lg"></i>
              </div>
              <span className="font-semibold text-gray-900 text-lg">PanelSystem</span>
            </div>
            
            {/* 탭 네비게이션 */}
            <nav className="flex items-center gap-6 h-full">
              <button 
                className={`h-full flex items-center px-2 text-sm transition-colors ${getTabClass('panel')}`}
                onClick={() => onTabChange('panel')}
              >
                <i className="ri-search-2-line mr-2"></i>
                패널 추출
              </button>
              <button 
                className={`h-full flex items-center px-2 text-sm transition-colors ${getTabClass('doctor')}`}
                onClick={() => onTabChange('doctor')}
              >
                <i className="ri-stethoscope-line mr-2"></i>
                AI 닥터
              </button>
            </nav>
          </div>

          {/* 사용자 메뉴 (예시) */}
          
        </div>
      </div>
    </header>
  );
}
