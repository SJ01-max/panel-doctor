import React from 'react';

export interface SemanticPanel {
  panel_id?: string;
  respondent_id?: string;
  score: number;
  age: number;
  gender: string;
  region: string;
  match_reasons?: string[];
  brand_affinity?: Record<string, number>;
}

export const PanelCard: React.FC<{ panel: SemanticPanel }> = ({ panel }) => {
  const { score, age, gender, region, match_reasons = [], brand_affinity = {} } = panel;

  // brand_affinity 상위 3개 추출
  const topBrands = Object.entries(brand_affinity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([brand, score]) => ({ brand, score: Math.round(score * 100) }));

  return (
    <div className="bg-white rounded-xl shadow border border-gray-100 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xl font-bold text-violet-700">{score}%</div>
        <div className="text-xs text-gray-500">
          {age}세 · {gender} · {region}
        </div>
      </div>

      {match_reasons.length > 0 && (
        <div className="mt-1">
          <p className="font-medium text-gray-800 text-sm mb-1">매칭 이유</p>
          <ul className="list-disc ml-4 text-xs text-gray-700 space-y-1">
            {match_reasons.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {topBrands.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="font-medium text-gray-800 text-sm mb-1">브랜드 선호도</p>
          <div className="flex flex-wrap gap-2">
            {topBrands.map(({ brand, score }) => (
              <span
                key={brand}
                className="px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium"
              >
                {brand} {score}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


