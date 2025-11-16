import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header'; 
import Sidebar from '../../components/layout/Sidebar';
import PanelDashboard from '../../features/panel/Dashboard';
import QueryCanvas from '../../features/panel/QueryCanvas';
import ReportView from '../../features/panel/ReportView';
import DoctorDashboard from '../../features/doctor/Dashboard';
import PersonalQuery from '../../features/doctor/PersonalQuery';

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  // (수정) 기본 탭을 URL 파라미터에서 읽어오도록 개선
  const [activeTab, setActiveTab] = useState<'panel' | 'doctor'>(
    searchParams.get('tab') === 'doctor' ? 'doctor' : 'panel'
  );
  const [activeMenu, setActiveMenu] = useState('dashboard');

  // URL 파라미터에서 탭 상태 읽기
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'doctor' || tab === 'panel') {
      setActiveTab(tab);
    } else {
      // URL에 탭 정보가 없으면 'panel'로 기본 설정
      setSearchParams({ tab: 'panel' });
    }
  }, [searchParams, setSearchParams]);

  const renderContent = () => {
    if (activeTab === 'panel') {
      switch (activeMenu) {
        case 'dashboard':
          return <PanelDashboard />;
        case 'query':
          return <QueryCanvas />;
        case 'results':
          return <ReportView />;
        default:
          return <PanelDashboard />;
      }
    } else { // activeTab === 'doctor'
      switch (activeMenu) {
        case 'dashboard':
          return <DoctorDashboard />;
        case 'query':
          return <PersonalQuery />;
        case 'results':
          return (
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">추천 결과</h1>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                <i className="ri-medicine-bottle-line text-4xl text-gray-400 mb-4"></i>
                <p className="text-gray-600">추천 결과 히스토리가 여기에 표시됩니다.</p>
              </div>
            </div>
          );
        // (설정 메뉴 등 추가)
        default:
          return <DoctorDashboard />;
      }
    }
  };

  const handleTabChange = (tab: 'panel' | 'doctor') => {
    setActiveTab(tab);
    setActiveMenu('dashboard'); // 탭 변경 시 대시보드로 리셋
    
    // URL 파라미터 업데이트
    setSearchParams({ tab });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* (수정) Header에 props 전달 (컴포넌트 정의에 따라 다를 수 있음) */}
      <Header activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="flex flex-1 overflow-hidden">
        {/* (수정) Sidebar에 props 전달 (컴포넌트 정의에 따라 다를 수 있음) */}
        <Sidebar activeTab={activeTab} activeMenu={activeMenu} onMenuClick={setActiveMenu} />
        <main className="flex-1 overflow-y-auto bg-gray-100">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
