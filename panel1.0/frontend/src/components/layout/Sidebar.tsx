import type { Dispatch, SetStateAction } from 'react';

// 1. page.tsx에서 전달하는 props를 받도록 타입을 정의합니다. (오류 수정)
export interface SidebarProps {
  activeTab: 'panel' | 'doctor';
  activeMenu: string;
  onMenuClick: Dispatch<SetStateAction<string>>; // 또는 (menu: string) => void;
}

// 2. 탭별 메뉴 데이터를 정의합니다.
const panelMenus = [
  { id: 'dashboard', name: '대시보드', icon: 'ri-dashboard-line' },
  { id: 'query', name: '자연어 질의', icon: 'ri-edit-box-line' },
  { id: 'results', name: '결과/리포트', icon: 'ri-file-chart-line' },
];

const doctorMenus = [
  { id: 'dashboard', name: 'AI 닥터 홈', icon: 'ri-home-heart-line' },
  { id: 'query', name: '개인 질의', icon: 'ri-chat-3-line' },
  { id: 'results', name: '추천 결과', icon: 'ri-medicine-bottle-line' },
  { id: 'settings', name: '설정', icon: 'ri-settings-3-line' },
];

export default function Sidebar({ activeTab, activeMenu, onMenuClick }: SidebarProps) {
  
  // 3. activeTab에 따라 렌더링할 메뉴를 선택합니다.
  const menus = activeTab === 'panel' ? panelMenus : doctorMenus;

  const getMenuClass = (menuId: string) => {
    return activeMenu === menuId
      ? "bg-[#2F6BFF]/10 text-[#2F6BFF] font-medium" // 활성 메뉴
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"; // 비활성 메뉴
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 p-4">
      <nav className="flex flex-col space-y-2">
        {/* 4. 선택된 menus 배열을 map으로 렌더링합니다. */}
        {menus.map((menu) => (
          <button
            key={menu.id}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${getMenuClass(menu.id)}`}
            onClick={() => onMenuClick(menu.id)}
          >
            <i className={`${menu.icon} text-lg`}></i>
            <span>{menu.name}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
