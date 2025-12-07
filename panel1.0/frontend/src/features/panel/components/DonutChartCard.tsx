import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { MapPin } from 'lucide-react';

interface DonutChartCardProps {
  title: string;
  data: Array<{ name: string; value: number }>;
  subtitle?: string;
  totalCount?: number;
}

// Single Region Card 컴포넌트
const SingleRegionCard: React.FC<{ region: string; count: number; totalCount: number }> = ({
  region,
  count,
  totalCount
}) => {
  const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-50 via-indigo-50 to-blue-50 border border-violet-100 p-6 flex flex-col items-center justify-center min-h-[200px] shadow-sm relative overflow-hidden">
      {/* 배경 지도 아이콘 (Watermark 효과) */}
      <div className="absolute bottom-0 right-0 opacity-10 pointer-events-none">
        <MapPin size={200} className="text-violet-400" />
      </div>
      
      {/* 메인 콘텐츠 */}
      <div className="relative z-10 text-center">
        {/* 지역명: 큰 글자 + 그라데이션 */}
        <div className="text-5xl font-extrabold mb-3 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
          {region}
        </div>
        {/* 인원수: 강조 */}
        <div className="text-2xl font-bold text-violet-700 mb-1">
          {count.toLocaleString()}명
        </div>
        {percentage > 0 && (
          <div className="text-sm text-violet-600 font-medium">
            전체의 {percentage}%
          </div>
        )}
      </div>
    </div>
  );
};

export const DonutChartCard: React.FC<DonutChartCardProps> = ({
  title,
  data,
  subtitle,
  totalCount
}) => {
  // 데이터가 1개일 때는 Single Region Card 표시
  if (data.length === 1) {
    return (
      <div className="rounded-2xl bg-white border border-gray-100 p-4 flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">
            {title}
          </span>
          {subtitle && (
            <span className="text-[10px] text-gray-400">
              {subtitle}
            </span>
          )}
        </div>
        <SingleRegionCard
          region={data[0].name}
          count={data[0].value}
          totalCount={totalCount || data[0].value}
        />
      </div>
    );
  }

  // 데이터가 2개 이상일 때는 기존 도넛 차트 표시
  const mainRegion = data[0]?.name || '-';
  const mainValue = data[0]?.value || 0;
  // 전체 검색 결과 대비 비율 계산
  const percentage = totalCount && totalCount > 0 ? Math.round((mainValue / totalCount) * 100) : 0;
  const colors = ['#7c5cff', '#6b7dff', '#5bc3ff', '#a78bfa', '#ddd6fe'];

  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">
          {title}
        </span>
        {subtitle && (
          <span className="text-[10px] text-gray-400">
            {subtitle}
          </span>
        )}
      </div>
      {/* 도넛 차트 */}
      <div className="flex items-center gap-4 mt-2">
        <div className="relative w-28 h-28 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={28}
                outerRadius={56}
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
              >
                {data.map((entry, index) => {
                  const colors = ['#7c5cff', '#6b7dff', '#5bc3ff', '#a78bfa'];
                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                })}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-xs font-semibold text-gray-700">
                {mainRegion}
              </div>
              <div className="text-[10px] text-gray-500">
                {percentage > 0 ? `${percentage}%` : ''}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-xs flex-1">
          {data.slice(0, 5).map((r, idx) => {
            // 전체 검색 결과 대비 비율 계산
            const itemPercentage = totalCount && totalCount > 0 ? Math.round((r.value / totalCount) * 100) : 0;
            return (
              <div
                key={idx}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                  <span className="text-gray-600">{r.name}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-gray-800 font-semibold">{r.value}명</span>
                  <span className="text-gray-500 text-[10px]">{itemPercentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

