import React from 'react';

interface InsightSummaryProps {
  summary: string;
  keywords: string[];
  features: string[];
}

export const InsightSummary: React.FC<InsightSummaryProps> = ({
  summary,
  keywords,
  features,
}) => {
  if (!summary && keywords.length === 0 && features.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-2xl p-6 shadow-lg mb-6">
      <h2 className="text-lg md:text-xl font-semibold mb-3">🧠 AI 인사이트 요약</h2>
      {summary && <p className="text-sm md:text-base mb-4">{summary}</p>}

      {keywords.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">핵심 키워드</h3>
          <div className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <span
                key={k}
                className="px-3 py-1 bg-white/20 rounded-full text-xs md:text-sm backdrop-blur-sm"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {features.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">공통 성향</h3>
          <ul className="list-disc ml-4 space-y-1 text-xs md:text-sm">
            {features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};


