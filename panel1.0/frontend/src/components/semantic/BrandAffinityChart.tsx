import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface BrandAffinityChartProps {
  brandAffinity: Record<string, number>;
  maxItems?: number;
}

export const BrandAffinityChart: React.FC<BrandAffinityChartProps> = ({
  brandAffinity,
  maxItems = 5,
}) => {
  if (!brandAffinity || Object.keys(brandAffinity).length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        브랜드 선호도 데이터가 없습니다.
      </div>
    );
  }

  // 상위 N개만 추출 및 정렬
  const data = Object.entries(brandAffinity)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, maxItems);

  // 색상 팔레트 (보라색 계열)
  const colors = ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

  return (
    <div className="w-full">
      <h4 className="text-sm font-medium text-gray-700 mb-3">브랜드 선호도 Top {maxItems}</h4>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" barCategoryGap="15%">
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} />
          <YAxis
            dataKey="name"
            type="category"
            width={80}
            tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload[0]) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg text-sm">
                    <p className="font-bold text-gray-900 mb-1">{data.name}</p>
                    <p className="text-violet-600 font-semibold">선호도: {data.value}%</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="value" radius={[0, 12, 12, 0]} barSize={40}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

