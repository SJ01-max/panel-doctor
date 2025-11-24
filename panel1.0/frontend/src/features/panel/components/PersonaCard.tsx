import React from "react";
import { Quote, Sparkles } from "lucide-react";
import type { Persona } from "../../../api/llm";
import { PersonaLoadingState } from "./PersonaLoadingState";

interface PersonaCardProps {
  persona: Persona | null | undefined;
  isLoading?: boolean;
  hasSearched?: boolean;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({
  persona,
  isLoading = false,
  hasSearched = false,
}) => {

  /** 1) 로딩 중이면 스켈레톤 표시 (레이아웃 시프트 방지) */
  if (isLoading) {
    return <PersonaLoadingState />;
  }

  /** 2) 검색 전 → 자리 유지되는 안내 카드 */
  if (!hasSearched) {
    return (
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 flex items-center justify-center h-[220px] text-slate-400 text-sm">
        왼쪽에서 검색을 진행해주세요.
      </div>
    );
  }

  /** 3) 검색은 했는데 persona 없음 → "결과 없음" 안내 */
  if (hasSearched && !persona) {
    return (
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 flex items-center justify-center h-[220px] text-slate-500 text-sm">
        분석 가능한 데이터를 찾을 수 없습니다.
      </div>
    );
  }

  /** 4) 정상 카드 렌더링 */
  // 이 시점에서는 persona가 반드시 존재함 (위의 조건문에서 이미 체크됨)
  if (!persona) {
    return <PersonaLoadingState />; // 타입 가드를 위한 안전장치 (null 반환 방지)
  }

  const getGenderIcon = () => {
    if (!persona.age_gender) return "👤";
    const g = persona.age_gender;
    if (g.includes("여성") || g.includes("여자")) return "👩";
    if (g.includes("남성") || g.includes("남자")) return "👨";
    return "👤";
  };

  return (
    <div className="rounded-2xl bg-white border border-violet-100 p-6 flex gap-4 shadow-sm hover:shadow-md transition-all duration-300 h-full animate-fade-in">
      {/* Profile icon */}
      <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-full flex items-center justify-center shadow-inner">
        <span className="text-4xl">{getGenderIcon()}</span>
      </div>

      {/* Text / Info Area */}
      <div className="flex-1 flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold text-gray-900">{persona.name}</h3>
            <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <p className="text-sm text-gray-500 font-medium">
            {persona.age_gender}
          </p>
        </div>

        {/* Quote */}
        <div className="flex items-start gap-2 bg-violet-50/50 p-3 rounded-xl">
          <Quote className="w-4 h-4 text-violet-500 mt-0.5" />
          <p className="text-sm text-violet-700 italic leading-relaxed">
            "{persona.quote}"
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-700 leading-relaxed">
          {persona.description}
        </p>

        {/* Tags */}
        {persona.tags && persona.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {persona.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 bg-white border border-violet-100 text-violet-600 rounded-md text-xs font-semibold shadow-sm"
              >
                {tag.startsWith("#") ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
