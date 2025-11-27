import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ScatterChart,
  Scatter,
} from 'recharts';

interface MatchChartsProps {
  genderData: Array<{ name: string; value: number }>;
  ageData: Array<{ name: string; value: number }>;
  regionData: Array<{ name: string; value: number }>;
  scatterData?: Array<{ age: number; score: number }>;
}

const VIOLET_COLORS = ['#7c3aed', '#a855f7', '#c4b5fd', '#e5e7eb'];

export const MatchCharts: React.FC<MatchChartsProps> = ({
  genderData,
  ageData,
  regionData,
  scatterData = [],
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Gender Donut */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-64 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">성별 분포</h3>
        <div className="flex-1 min-h-0">
          {genderData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={4}
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-g-${index}`} fill={VIOLET_COLORS[index] || VIOLET_COLORS[0]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value}명`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-gray-400">
              데이터 없음
            </div>
          )}
        </div>
      </div>

      {/* Age Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-64 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">연령대 분포</h3>
        <div className="flex-1 min-h-0">
          {ageData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(value: number) => `${value}명`} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-gray-400">
              데이터 없음
            </div>
          )}
        </div>
      </div>

      {/* Region or Scatter */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-64 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">지역 / 점수 분포</h3>
        <div className="flex-1 min-h-0">
          {regionData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `${value}명`} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          ) : scatterData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="age" name="나이" type="number" domain={[0, 100]} />
                <YAxis dataKey="score" name="Score" type="number" domain={[0, 100]} />
                <Tooltip formatter={(value: number) => `${value}`} />
                <Scatter data={scatterData} fill="#7c3aed" />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-gray-400">
              데이터 없음
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


