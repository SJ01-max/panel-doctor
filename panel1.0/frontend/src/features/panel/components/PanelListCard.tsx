import React from 'react';

export interface PanelItem {
  id: string;
  gender: string;
  age: string;
  region: string;
  birthYear?: string;
  lastResponseDate?: string;
  matchScore?: number; // 적합도 점수 (0-100)
}

interface PanelListCardProps {
  panels: PanelItem[];
  onPanelClick: (panel: PanelItem) => void;
  maxItems?: number;
}

export const PanelListCard: React.FC<PanelListCardProps> = ({
  panels,
  onPanelClick,
  maxItems = 4
}) => {
  const [showAll, setShowAll] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(maxItems);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  
  // 전체 보기 시 점진적 로딩 (성능 최적화)
  React.useEffect(() => {
    if (showAll && visibleCount < panels.length) {
      // 한 번에 20개씩 추가 로딩
      const loadMore = () => {
        setVisibleCount(prev => Math.min(prev + 20, panels.length));
      };
      
      // 초기 로딩
      const timer = setTimeout(loadMore, 0);
      
      // 스크롤 이벤트로 추가 로딩
      const handleScroll = () => {
        if (scrollContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
          // 스크롤이 하단 200px 이내에 도달하면 추가 로딩
          if (scrollHeight - scrollTop - clientHeight < 200 && visibleCount < panels.length) {
            loadMore();
          }
        }
      };
      
      const container = scrollContainerRef.current;
      if (container) {
        container.addEventListener('scroll', handleScroll);
        return () => {
          clearTimeout(timer);
          container.removeEventListener('scroll', handleScroll);
        };
      }
      
      return () => clearTimeout(timer);
    } else if (!showAll) {
      // 접기 시 초기화
      setVisibleCount(maxItems);
    }
  }, [showAll, panels.length, visibleCount, maxItems]);
  
  const handleViewAll = () => {
    setShowAll(true);
    setVisibleCount(Math.min(20, panels.length)); // 초기 20개만 로딩
    // 테이블로 스크롤하고 약간의 딜레이 후 스크롤 위치 조정
    setTimeout(() => {
      const tableElement = document.querySelector('.data-table');
      if (tableElement) {
        const yOffset = -20; // 상단 여백
        const y = tableElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 100);
  };
  
  const displayPanels = showAll ? panels.slice(0, visibleCount) : panels.slice(0, maxItems);
  
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">
          {showAll 
            ? `패널 리스트 (전체 ${panels.length}명)`
            : `패널 리스트 (상위 ${Math.min(maxItems, panels.length)}명 예시)`
          }
        </span>
        {!showAll && (
          <button 
            onClick={handleViewAll}
            className="text-[11px] text-[#7c5cff] hover:underline"
          >
            전체 보기 &gt;
          </button>
        )}
        {showAll && (
          <button 
            onClick={() => {
              setShowAll(false);
              // 위로 스크롤
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-[11px] text-[#7c5cff] hover:underline"
          >
            접기 &lt;
          </button>
        )}
      </div>
      <div 
        ref={scrollContainerRef}
        className="flex flex-col gap-2 text-xs md:text-sm max-h-[600px] overflow-y-auto"
      >
        {displayPanels.map((panel, i) => (
          <div
            key={i}
            onClick={() => onPanelClick(panel)}
            className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 hover:bg-[#f9f9ff] cursor-pointer transition"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#f2f3ff] flex items-center justify-center text-[13px]">
                👤
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500">
                  패널 ID
                </span>
                <span className="text-xs font-medium text-gray-800">
                  {panel.id}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">
                  {panel.gender || '-'} · {panel.age || '-'} · {panel.region || '-'}
                </span>
                {panel.matchScore !== undefined && (
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {Math.round(panel.matchScore)}% 일치
                  </span>
                )}
              </div>
              {panel.lastResponseDate && (
                <span className="text-[10px] text-gray-400">
                  최근 응답: {panel.lastResponseDate}
                </span>
              )}
            </div>
          </div>
        ))}
        {showAll && visibleCount < panels.length && (
          <div className="text-center py-2 text-xs text-gray-400">
            로딩 중... ({visibleCount} / {panels.length})
          </div>
        )}
      </div>
    </div>
  );
};

