import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface CarTypeChartProps {
  carTypeAffinity: Record<string, number>;
  maxItems?: number;
}

export const CarTypeChart: React.FC<CarTypeChartProps> = ({
  carTypeAffinity,
  maxItems = 5,
}) => {
  if (!carTypeAffinity || Object.keys(carTypeAffinity).length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        차량 타입 선호도 데이터가 없습니다.
      </div>
    );
  }

  // 차량 모델명 그대로 표시 (아반떼, 소나타, K5 등)
  const data = Object.entries(carTypeAffinity)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, maxItems);

  // 색상 팔레트 (보라색 계열)
  const colors = ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

  return (
    <div className="w-full">
      <h4 className="text-sm font-medium text-gray-700 mb-3">차량 모델 선호도 Top {maxItems}</h4>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
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
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

