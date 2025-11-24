import React from 'react';
import { Sparkles } from 'lucide-react';

export const PersonaLoadingState = () => {
  return (
    // 1. 테두리가 은은하게 보라색으로 숨쉬는 효과 (animate-pulse + border-violet)
    <div className="relative rounded-2xl bg-white/50 border border-violet-100 p-6 flex gap-4 shadow-sm h-full w-full overflow-hidden">
      
      {/* 2. Shimmer Effect (빛이 지나가는 애니메이션 레이어) */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent z-10" />

      {/* 아바타 영역 */}
      <div className="relative">
        <div className="w-20 h-20 bg-violet-50 rounded-full flex-shrink-0 flex items-center justify-center">
           {/* 3. 회전하는 AI 아이콘 */}
           <Sparkles className="w-8 h-8 text-violet-300 animate-spin-slow" />
        </div>
      </div>

      {/* 텍스트 스켈레톤 영역 */}
      <div className="flex-1 flex flex-col gap-4 z-0">
        {/* 제목 */}
        <div className="h-8 bg-slate-100 rounded-lg w-1/3" />
        
        {/* 인용구 (약간 더 진한 배경) */}
        <div className="h-16 bg-slate-50 rounded-xl w-full border border-slate-100" />
        
        {/* 설명 (3줄 - 길이 다르게) */}
        <div className="space-y-2">
          <div className="h-4 bg-slate-100 rounded w-full" />
          <div className="h-4 bg-slate-100 rounded w-11/12" />
          <div className="h-4 bg-slate-100 rounded w-4/5" />
        </div>

        {/* 태그 */}
        <div className="flex gap-2 mt-2">
          <div className="h-6 w-16 bg-violet-50 rounded-full" />
          <div className="h-6 w-20 bg-violet-50 rounded-full" />
          <div className="h-6 w-14 bg-violet-50 rounded-full" />
        </div>
      </div>

      {/* CSS Keyframes (Tailwind 설정 없이 바로 적용) */}
      <style>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
