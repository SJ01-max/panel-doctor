import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, LabelList
} from 'recharts';
import { Users, MapPin, TrendingUp, Activity, Hash, Calendar } from 'lucide-react';
import { getDashboardData } from '../../api/panel';

// --- 1. Mock Data (Fallback) ---
const GENDER_DATA_FALLBACK = [
  { name: '남성', value: 17500, color: '#6366f1' }, // Indigo
  { name: '여성', value: 18612, color: '#ec4899' }, // Pink
];

const AGE_DATA_FALLBACK = [
  { name: '20대', value: 8500 },
  { name: '30대', value: 12000 },
  { name: '40대', value: 9500 },
  { name: '50대', value: 7200 },
  { name: '60대', value: 4500 },
  { name: '70대', value: 2412 },
];

const REGION_DATA_FALLBACK = [
  { name: '서울', value: 12400 },
  { name: '경기', value: 9800 },
  { name: '부산', value: 4200 },
  { name: '인천', value: 3100 },
  { name: '대구', value: 2900 },
];

const TRENDING_TOPICS = [
  { keyword: '반려동물', count: 3200, color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { keyword: '여행', count: 2800, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { keyword: '헬스', count: 2400, color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { keyword: 'OTT', count: 2100, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { keyword: '커피', count: 1950, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { keyword: '재테크', count: 1850, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { keyword: '아이폰', count: 1650, color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { keyword: '캠핑', count: 1450, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { keyword: '독서', count: 1350, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { keyword: '요리', count: 1250, color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { keyword: '게임', count: 1150, color: 'bg-red-50 text-red-700 border-red-200' },
  { keyword: '음악', count: 1050, color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { keyword: '영화', count: 980, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { keyword: '뷰티', count: 920, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { keyword: '패션', count: 880, color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  { keyword: '자동차', count: 850, color: 'bg-gray-50 text-gray-700 border-gray-200' },
  { keyword: '부동산', count: 820, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { keyword: '교육', count: 780, color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { keyword: '투자', count: 750, color: 'bg-green-50 text-green-700 border-green-200' },
  { keyword: '요가', count: 720, color: 'bg-lime-50 text-lime-700 border-lime-200' },
  { keyword: '러닝', count: 690, color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { keyword: '사진', count: 660, color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { keyword: '그림', count: 630, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { keyword: '악기', count: 600, color: 'bg-amber-50 text-amber-700 border-amber-200' },
];

// --- 2. Custom Components ---

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-100 shadow-xl rounded-xl p-3">
        <p className="text-xs font-semibold text-slate-800 mb-1 uppercase tracking-wide">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color || '#8b5cf6' }}
              />
              <span className="text-xs text-slate-600">{entry.name || 'Value'}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">
              {entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// 유리 질감의 카드 컴포넌트
const BentoCard = ({ children, className, delay = 0, title, icon: Icon }: any) => {
  const delayClass = delay > 0 ? `animate-card-enter-delay-${Math.round(delay * 10)}` : 'animate-card-enter';
  const hasOverflowVisible = className?.includes('overflow-visible');
  const overflowClass = hasOverflowVisible ? 'overflow-visible' : 'overflow-hidden';
  
  return (
    <div
      className={`bg-white rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${overflowClass} flex flex-col ${delayClass} ${className}`}
    >
      {title && (
        <div className="px-6 pt-6 pb-2 flex items-center gap-2 mb-2">
          <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
            <Icon size={18} />
          </div>
          <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">{title}</h3>
        </div>
      )}
      <div className="flex-1 px-6 pb-6 relative">
        {children}
      </div>
    </div>
  );
};

// 숫자 카운팅 컴포넌트
const Counter = ({ value }: { value: number }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const duration = 1500; // 1.5초 동안 카운팅
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = value / steps;
    
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
    } else {
        setCount(Math.floor(current));
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);

  return <span>{count.toLocaleString()}</span>;
};

// --- 3. Main Dashboard ---

// 캐시 키
const DASHBOARD_CACHE_KEY = 'panel_doctor_dashboard_cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5분

// 캐시에서 데이터 로드
const loadCachedDashboardData = (): any | null => {
  try {
    const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // 캐시가 만료되지 않았으면 반환
    if (now - timestamp < CACHE_EXPIRY_MS) {
      return data;
    }
    
    // 만료된 캐시 삭제
    localStorage.removeItem(DASHBOARD_CACHE_KEY);
    return null;
  } catch (error) {
    console.error('캐시 로드 오류:', error);
    return null;
  }
};

// 데이터를 캐시에 저장
const saveDashboardDataToCache = (data: any) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('캐시 저장 오류:', error);
  }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [genderData, setGenderData] = useState(GENDER_DATA_FALLBACK);
  const [ageData, setAgeData] = useState(AGE_DATA_FALLBACK);
  const [regionData, setRegionData] = useState(REGION_DATA_FALLBACK);
  const [trendingTopics, setTrendingTopics] = useState(TRENDING_TOPICS);
  const [totalPanels, setTotalPanels] = useState(36112);
  const [isLoading, setIsLoading] = useState(false); // 초기값을 false로 변경 (캐시에서 먼저 로드)

  useEffect(() => {
    const loadDashboardData = async () => {
      // 1. 먼저 캐시에서 데이터 로드
      const cachedData = loadCachedDashboardData();
      if (cachedData) {
        console.log('[Dashboard] 캐시에서 데이터 로드');
        // 캐시된 데이터로 상태 업데이트
        if (cachedData.panelSummary?.genderDistribution) {
          const gender = cachedData.panelSummary.genderDistribution.map((item: any) => ({
            name: item.name,
            value: item.value,
            color: item.name === '남성' ? '#6366f1' : '#ec4899'
          }));
          setGenderData(gender);
        }
        if (cachedData.panelSummary?.ageDistribution) {
          const age = cachedData.panelSummary.ageDistribution.map((item: any) => ({
            name: item.age,
            value: item.count
          }));
          setAgeData(age);
        }
        if (cachedData.panelSummary?.regionDistribution) {
          const region = cachedData.panelSummary.regionDistribution.map((item: any) => ({
            name: item.name,
            value: item.value
          }));
          setRegionData(region);
        }
        if (cachedData.panelSummary?.totalPanels) {
          setTotalPanels(cachedData.panelSummary.totalPanels);
        }
        if (cachedData.panelSummary?.trendingKeywords) {
          const keywords = cachedData.panelSummary.trendingKeywords.map((item: any) => ({
            keyword: item.keyword,
            count: item.count
          }));
          setTrendingTopics(keywords);
        }
        setIsLoading(false);
      } else {
        // 캐시가 없으면 로딩 표시
        setIsLoading(true);
      }

      // 2. 백그라운드에서 최신 데이터 가져오기
      try {
        const data = await getDashboardData();
        
        // 성별 분포 데이터 변환
        if (data.panelSummary?.genderDistribution && data.panelSummary.genderDistribution.length > 0) {
          const gender = data.panelSummary.genderDistribution.map((item: any) => ({
            name: item.name,
            value: item.value,
            color: item.name === '남성' ? '#6366f1' : '#ec4899'
          }));
          setGenderData(gender);
        }
        
        // 연령대 분포 데이터 변환
        if (data.panelSummary?.ageDistribution && data.panelSummary.ageDistribution.length > 0) {
          const age = data.panelSummary.ageDistribution.map((item: any) => ({
            name: item.age,
            value: item.count
          }));
          console.log('연령대 분포 데이터:', age); // 디버깅용
          setAgeData(age);
        } else {
          console.log('연령대 분포 데이터 없음:', data.panelSummary);
        }
        
        // 지역 분포 데이터 변환
        if (data.panelSummary?.regionDistribution && data.panelSummary.regionDistribution.length > 0) {
          const region = data.panelSummary.regionDistribution.map((item: any) => ({
            name: item.name,
            value: item.value
          }));
          setRegionData(region);
        }
        
        // 총 패널 수
        if (data.panelSummary?.totalPanels) {
          setTotalPanels(data.panelSummary.totalPanels);
        }
        
        // 키워드 데이터 변환
        if (data.panelSummary?.trendingKeywords && data.panelSummary.trendingKeywords.length > 0) {
          const keywords = data.panelSummary.trendingKeywords.map((item: any) => ({
            keyword: item.keyword,
            count: item.count
          }));
          console.log('키워드 데이터:', keywords); // 디버깅용
          setTrendingTopics(keywords);
        } else {
          console.log('키워드 데이터 없음, Mock 데이터 사용');
        }
        
        // 캐시에 저장
        saveDashboardDataToCache(data);
      } catch (error) {
        console.error('대시보드 데이터 로드 실패:', error);
        // 에러 발생 시에도 캐시가 있으면 그대로 사용
        if (!cachedData) {
          // 캐시도 없고 API도 실패하면 Fallback 데이터 사용
          console.log('[Dashboard] Fallback 데이터 사용');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

          return (
    <div className="min-h-screen bg-[#f8fafc] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-end animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              데이터 모니터링 <span className="text-sm font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Live</span>
            </h1>
            <p className="text-slate-500 mt-1">전체 패널 데이터의 실시간 현황 및 분포 분석</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <Calendar size={14} />
            <span>2025년 11월 23일 기준</span>
          </div>
        </header>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-6 h-[800px]">
          
          {/* 1. Total KPI (Smaller) */}
          <BentoCard className="md:col-span-1 md:row-span-1 bg-gradient-to-br from-violet-600 to-indigo-700 text-white border-none" delay={0.1}>
            <div className="h-full flex flex-col justify-between relative z-10 p-2">
              <div>
                <div className="flex items-center gap-2 text-indigo-200 font-medium mb-1">
                  <Users size={20} /> TOTAL PANELS
                </div>
                <div className="relative">
                  <div className="flex items-baseline gap-2">
                    <div className="text-5xl font-bold tracking-tight leading-none">
                      <Counter value={totalPanels} />
                    </div>
                    <span className="text-4xl font-bold text-indigo-200 leading-none">명</span>
                  </div>
                  {/* Mini Sparkline */}
                  <svg 
                    className="absolute bottom-[-8px] left-0 w-32 h-8 opacity-30"
                    viewBox="0 0 100 20"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M 0,15 Q 20,10 40,8 T 80,5 T 100,3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2">
                  <TrendingUp size={16} className="text-green-300" />
                  <span className="font-medium">+124 New</span>
                </div>
                <span className="text-indigo-200 text-sm">이번 주 신규 가입 패널</span>
              </div>
            </div>
            {/* Background Pattern - Watermark */}
            <div className="absolute bottom-[-20px] right-[-20px] opacity-10 pointer-events-none rotate-12">
              <Users size={200} strokeWidth={1} />
            </div>
          </BentoCard>

          {/* 2. Gender Distribution */}
          <BentoCard className="md:col-span-1 md:row-span-1" title="성별 분포" icon={Activity} delay={0.2}>
            <div className="h-full flex flex-col items-center justify-center relative">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-slate-400 text-sm">로딩 중...</div>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={genderData}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        onClick={(data: any) => {
                          if (data && data.name) {
                            navigate(`/search?q=${encodeURIComponent(data.name + ' 패널')}`);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {genderData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color}
                            className="hover:opacity-80 transition-opacity"
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {(() => {
                    const total = genderData.reduce((sum, entry) => sum + entry.value, 0);
                    const femaleData = genderData.find(entry => entry.name === '여성');
                    const maleData = genderData.find(entry => entry.name === '남성');
                    const femalePercent = femaleData ? Math.round((femaleData.value / total) * 100) : 0;
                    const malePercent = maleData ? Math.round((maleData.value / total) * 100) : 0;
                    return (
                      <div className="flex gap-4 text-xs font-medium text-slate-500 mt-2">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"/>남성 {malePercent}%</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pink-500"/>여성 {femalePercent}%</span>
            </div>
          );
                  })()}
                </>
              )}
            </div>
          </BentoCard>

          {/* 3. Age Distribution (Vertical Bar - Larger) */}
          <BentoCard className="md:col-span-2 md:row-span-1" title="연령대 분포" icon={Users} delay={0.3}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-slate-400 text-sm">로딩 중...</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={ageData} 
                  margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                  onClick={(data: any) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const ageGroup = data.activePayload[0].payload.name;
                      navigate(`/search?q=${encodeURIComponent(ageGroup + ' 패널')}`);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fill: '#64748b', fontWeight: 500}}
                    angle={0}
                    textAnchor="middle"
                    interval={0}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8'}} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: '#f1f5f9', radius: 4}} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                    {ageData.map((entry, index) => {
                      // Gradient color based on rank (darker for higher values)
                      const sortedData = [...ageData].sort((a, b) => b.value - a.value);
                      const rank = sortedData.findIndex(item => item.name === entry.name);
                      const colors = ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#e9d5ff', '#f3e8ff', '#faf5ff'];
                      const colorIndex = Math.min(rank, colors.length - 1);
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={colors[colorIndex]}
                          className="hover:opacity-80 transition-opacity"
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </BentoCard>

          {/* 4. Region Distribution (Horizontal Bar - Clean) */}
          <BentoCard className="md:col-span-2 md:row-span-1" title="지역별 패널 분포" icon={MapPin} delay={0.4}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-slate-400 text-sm">로딩 중...</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  layout="vertical" 
                  data={(() => {
                    // 지역 데이터를 값 기준으로 내림차순 정렬
                    const sortedRegions = [...regionData].sort((a, b) => b.value - a.value);
                    
                    // 상위 6개 추출
                    const top6 = sortedRegions.slice(0, 6);
                    
                    // 나머지 합산하여 "기타" 항목 생성
                    const others = sortedRegions.slice(6);
                    const othersTotal = others.reduce((sum, item) => sum + item.value, 0);
                    
                    // 상위 6개 + 기타 (총 7개)
                    const displayData = [...top6];
                    if (othersTotal > 0) {
                      displayData.push({ name: '기타', value: othersTotal });
                    }
                    
                    return displayData;
                  })()}
                  margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
                  onClick={(data: any) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const regionName = data.activePayload[0].payload.name;
                      if (regionName !== '기타') {
                        navigate(`/search?q=${encodeURIComponent(regionName + ' 거주 패널')}`);
                      }
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={40} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b', fontWeight: 600}} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {(() => {
                      const sortedRegions = [...regionData].sort((a, b) => b.value - a.value);
                      const top6 = sortedRegions.slice(0, 6);
                      const others = sortedRegions.slice(6);
                      const othersTotal = others.reduce((sum, item) => sum + item.value, 0);
                      const displayData = [...top6];
                      if (othersTotal > 0) {
                        displayData.push({ name: '기타', value: othersTotal });
                      }
                      
                      return displayData.map((entry, index) => {
                        // Gradient color based on rank (darker for higher values)
                        const colors = ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#e9d5ff', '#f3e8ff'];
                        const colorIndex = Math.min(index, colors.length - 1);
                        // 기타는 회색으로 표시
                        const fillColor = entry.name === '기타' ? '#94a3b8' : colors[colorIndex];
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={fillColor}
                            className="hover:opacity-80 transition-opacity"
                          />
                        );
                      });
                    })()}
                    <LabelList dataKey="value" position="right" style={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </BentoCard>

          {/* 5. Trending Topics (Weighted Bubble Cloud) - 지역별 패널 옆 */}
          <BentoCard className="md:col-span-2 md:row-span-1" title="패널 주요 관심사 키워드" icon={Hash} delay={0.5}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-slate-400 text-sm">로딩 중...</div>
              </div>
            ) : (
              <div className="h-full flex flex-wrap justify-center items-center gap-3 p-4 overflow-y-auto">
                {trendingTopics.map((topic, index) => {
                  const countK = topic.count / 1000;
                  
                  // Weighted Bubble Cloud: Size and style based on count
                  let sizeClass, textSizeClass, fontWeightClass, bgClass, textClass, borderClass;
                  
                  if (countK > 2.0) {
                    // Top Tier (> 2.0k): Large, Bold, Violet
                    sizeClass = 'px-4 py-2';
                    textSizeClass = 'text-base';
                    fontWeightClass = 'font-bold';
                    bgClass = 'bg-violet-100';
                    textClass = 'text-violet-800';
                    borderClass = 'border-violet-200';
                  } else if (countK >= 1.0) {
                    // Mid Tier (1.0k ~ 2.0k): Medium, Indigo
                    sizeClass = 'px-3 py-1.5';
                    textSizeClass = 'text-sm';
                    fontWeightClass = 'font-semibold';
                    bgClass = 'bg-indigo-50';
                    textClass = 'text-indigo-600';
                    borderClass = 'border-indigo-200';
                  } else {
                    // Low Tier (< 1.0k): Small, Slate
                    sizeClass = 'px-2 py-1';
                    textSizeClass = 'text-xs';
                    fontWeightClass = 'font-medium';
                    bgClass = 'bg-slate-50';
                    textClass = 'text-slate-500';
                    borderClass = 'border-slate-200';
                  }

  return (
                    <div
                      key={topic.keyword}
                      className={`
                        ${sizeClass} ${bgClass} ${textClass} ${borderClass} ${textSizeClass} ${fontWeightClass}
                        rounded-full border-2
                        shadow-sm hover:shadow-md hover:scale-110
                        transition-all duration-300 cursor-pointer
                        animate-float-subtle
                      `}
                      style={{ animationDelay: `${(index * 0.1) % 3}s` }}
                      title={`${topic.keyword}: ${topic.count.toLocaleString()}건`}
                    >
                      <span className="whitespace-nowrap">#{topic.keyword}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </BentoCard>

        </div>
      </div>
    </div>
  );
}
