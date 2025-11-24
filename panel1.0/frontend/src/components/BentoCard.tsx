import React from 'react';

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  span?: number;
  rowSpan?: number;
}

export const BentoCard = ({ 
  children, 
  className = '', 
  delay = 0,
  span,
  rowSpan 
}: BentoCardProps) => {
  const colSpanClass = span ? `md:col-span-${span}` : '';
  const rowSpanClass = rowSpan ? `md:row-span-${rowSpan}` : '';
  const delayClass = delay > 0 ? `animate-card-enter-delay-${Math.round(delay * 10)}` : 'animate-card-enter';

  return (
    <div
      className={`bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-3xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${colSpanClass} ${rowSpanClass} ${delayClass} ${className}`}
    >
      {children}
    </div>
  );
};
