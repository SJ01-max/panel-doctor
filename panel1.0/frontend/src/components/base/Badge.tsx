// (수정) ReactNode를 'import type'으로 분리합니다.
import type { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: ReactNode;
  className?: string;
}

export default function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  const variantClasses = {
    success: 'bg-[#18C08F]/10 text-[#18C08F] border-[#18C08F]/20',
    warning: 'bg-[#FFC757]/10 text-[#FFC757] border-[#FFC757]/20',
    error: 'bg-[#FF5A5A]/10 text-[#FF5A5A] border-[#FF5A5A]/20',
    info: 'bg-[#2F6BFF]/10 text-[#2F6BFF] border-[#2F6BFF]/20',
    neutral: 'bg-gray-100 text-gray-700 border-gray-200'
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

