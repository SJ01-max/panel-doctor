import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface ComparisonDonutChartProps {
  title: string;
  targetLabel: string;
  targetCount: number;
  targetPercentage: number;
  referenceLabel: string;
  referenceCount: number;
  referencePercentage: number;
  detailLabel?: string;
}

export const ComparisonDonutChart: React.FC<ComparisonDonutChartProps> = ({
  title,
  targetLabel,
  targetCount,
  targetPercentage,
  referenceLabel,
  referenceCount,
  referencePercentage,
  detailLabel
}) => {
  const data = [
    { name: targetLabel, value: targetCount },
    { name: referenceLabel, value: referenceCount }
  ];
  
  const colors = ['#7c5cff', '#e0e7ff']; // 보라색(타겟), 연한 보라색(기준 집단)
  
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-800 mb-5 text-center">{title}</h4>
      
      <div className="flex flex-col items-center gap-5">
        {/* 도넛 차트 */}
        <div className="relative w-36 h-36 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={45}
                outerRadius={72}
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-xs font-medium text-gray-600 mb-0.5">
                {targetLabel}
              </div>
              <div className="text-xl font-bold text-violet-600">
                {targetPercentage}%
              </div>
            </div>
          </div>
        </div>
        
        {/* 데이터 표시 */}
        <div className="w-full flex flex-col gap-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-violet-500 flex-shrink-0"></span>
              <span className="text-sm font-medium text-gray-700">{targetLabel}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">{targetCount.toLocaleString()}명</div>
              <div className="text-xs text-gray-500">{targetPercentage}%</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-violet-200 flex-shrink-0"></span>
              <span className="text-sm font-medium text-gray-700">{referenceLabel}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">{referenceCount.toLocaleString()}명</div>
              <div className="text-xs text-gray-500">{referencePercentage}%</div>
            </div>
          </div>
          
          {detailLabel && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-xs font-medium text-gray-600 text-center">
                <span className="text-violet-600 font-semibold">{detailLabel}</span> 기준
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

