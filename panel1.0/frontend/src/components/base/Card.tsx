// 1. React를 import 합니다.
import React from 'react';
// 2. 'ReactNode'는 타입이므로 'import type'을 사용합니다.
import type { ReactNode } from 'react';

// 3. (수정) CardProps가 div의 모든 기본 속성(onClick 포함)을 받도록
//    React.HTMLAttributes<HTMLDivElement>를 extends 합니다.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export default function Card({ 
  children, 
  className = '', 
  padding = 'md',
  ...props // 4. (수정) 나머지 모든 속성(onClick 등)을 props로 받습니다.
}: CardProps) {
  
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };
  
  return (
    // 5. (수정) ...props를 div에 전달하여 onClick 등이 적용되도록 합니다.
    <div 
      className={`bg-white rounded-xl shadow-sm border border-gray-100 ${paddingClasses[padding]} ${className}`}
      {...props} 
    >
      {children}
    </div>
  );
}

