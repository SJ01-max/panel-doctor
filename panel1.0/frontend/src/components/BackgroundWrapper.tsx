import React from 'react';

export const BackgroundWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative min-h-screen w-full bg-slate-50 overflow-hidden selection:bg-violet-100 selection:text-violet-900 font-sans text-slate-800">
      {/* 배경 그라데이션 Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-200/30 blur-[120px] mix-blend-multiply animate-blob" />
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-200/30 blur-[120px] mix-blend-multiply animate-blob animation-delay-2000" />
      <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] rounded-full bg-blue-200/30 blur-[120px] mix-blend-multiply animate-blob animation-delay-4000" />
      
      {/* 실제 콘텐츠 */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

