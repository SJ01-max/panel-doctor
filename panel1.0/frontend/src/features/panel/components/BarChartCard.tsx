import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, defs, linearGradient, stop } from 'recharts';

interface BarChartCardProps {
  title: string;
  data: Array<{ name: string; value: number }>;
  subtitle?: string;
}

export const BarChartCard: React.FC<BarChartCardProps> = ({
  title,
  data,
  subtitle
}) => {
  // 세로 막대 차트로 변경, Top N 제한 없이 전체 데이터 표시
  const maxValue = data.length > 0 ? Math.max(...data.map(d => d.value)) : 0;
  
  // 모든 막대를 동일한 violet 색상으로 통일 (깔끔하게)
  const chartData = data.map((item) => ({
    ...item,
    color: '#7c5cff' // violet-500 통일
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-200 rounded-lg shadow-sm">
          <p className="text-xs font-semibold text-gray-800">{payload[0].payload.name}</p>
          <p className="text-xs text-violet-600 font-medium">{payload[0].value}명</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            {title}
          </span>
        </div>
        {subtitle && (
          <span className="text-[10px] text-gray-400">
            {subtitle}
          </span>
        )}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
          >
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c5cff" stopOpacity={1} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              label={{ value: '명', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 11 } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="url(#barGradient)">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="url(#barGradient)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

