import React from 'react';

interface KeywordCloudProps {
  keywords: string[];
  maxItems?: number;
}

export const KeywordCloud: React.FC<KeywordCloudProps> = ({
  keywords,
  maxItems = 20,
}) => {
  if (!keywords || keywords.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        키워드 데이터가 없습니다.
      </div>
    );
  }

  const displayKeywords = keywords.slice(0, maxItems);

  // 키워드별 크기/색상 결정 (상위일수록 크고 진함)
  const getKeywordStyle = (index: number) => {
    const intensity = index < 5 ? 'strong' : index < 10 ? 'medium' : 'weak';
    const sizeClass =
      intensity === 'strong'
        ? 'text-lg px-4 py-2'
        : intensity === 'medium'
        ? 'text-base px-3 py-1.5'
        : 'text-sm px-2 py-1';
    const colorClass =
      intensity === 'strong'
        ? 'bg-violet-600 text-white font-bold'
        : intensity === 'medium'
        ? 'bg-violet-300 text-violet-900 font-semibold'
        : 'bg-violet-100 text-violet-700';

    return `${sizeClass} ${colorClass}`;
  };

  return (
    <div className="w-full">
      <h4 className="text-sm font-medium text-gray-700 mb-3">핵심 키워드</h4>
      <div className="flex flex-wrap gap-2">
        {displayKeywords.map((keyword, idx) => (
          <span
            key={idx}
            className={`${getKeywordStyle(idx)} rounded-full transition-all hover:scale-105`}
          >
            #{keyword}
          </span>
        ))}
      </div>
    </div>
  );
};

