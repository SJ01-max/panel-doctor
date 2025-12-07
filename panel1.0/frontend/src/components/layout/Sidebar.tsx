import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, Bookmark, Database, Archive, Settings } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  path: string;
  section: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    title: '개요',
    items: [
      { id: 'dashboard', name: '대시보드', icon: LayoutDashboard, path: '/dashboard', section: '개요' },
    ],
  },
  {
    title: '탐색',
    items: [
      { id: 'search', name: '패널 검색', icon: Search, path: '/search', section: '탐색' },
      { id: 'target-groups', name: '타겟 그룹', icon: Bookmark, path: '/target-groups', section: '탐색' },
    ],
  },
  {
    title: '데이터 허브',
    items: [
      { id: 'data-sources', name: '데이터 소스', icon: Database, path: '/data-sources', section: '데이터 허브' },
      { id: 'export-history', name: '내보내기 이력', icon: Archive, path: '/export-history', section: '데이터 허브' },
    ],
  },
  {
    title: '설정',
    items: [
      { id: 'settings', name: '서비스 설정', icon: Settings, path: '/settings', section: '설정' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 fixed top-16 left-0 h-[calc(100vh-4rem)] flex flex-col z-20">
      {/* Navigation - Scrollable */}
      <nav className="flex-1 overflow-y-auto flex flex-col space-y-6 p-4">
        {menuSections.map((section) => (
          <div key={section.title}>
            {/* Section Header */}
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">
              {section.title}
            </div>
            
            {/* Section Items */}
            <div className="space-y-1">
              {section.items.map((menu) => {
                const Icon = menu.icon;
                const active = isActive(menu.path);
                
                return (
                  <button
                    key={menu.id}
                    className={`relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 w-full ${
                      active
                        ? "bg-violet-50 text-violet-700 font-medium"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                    onClick={() => navigate(menu.path)}
                  >
                    <Icon size={18} className={active ? "text-violet-700" : "text-slate-500"} />
                    <span>{menu.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* System Status Card */}
      <div className="p-4 border-t border-slate-200 mt-auto">
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <div className="flex items-center gap-2">
            {/* Pulsing Green Dot */}
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-700">시스템 정상</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                지연시간: 12ms
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
