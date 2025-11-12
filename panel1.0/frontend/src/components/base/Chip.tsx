
import type { ReactNode } from 'react';

interface ChipProps {
  children: ReactNode;
  onRemove?: () => void;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'secondary';
  className?: string;
}

export default function Chip({ 
  children, 
  onRemove, 
  onClick, 
  variant = 'default', 
  className = '' 
}: ChipProps) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    primary: 'bg-[#2F6BFF]/10 text-[#2F6BFF] hover:bg-[#2F6BFF]/20',
    secondary: 'bg-[#00C2A8]/10 text-[#00C2A8] hover:bg-[#00C2A8]/20'
  };
  
  return (
    <div 
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${variantClasses[variant]} ${className}`}
      onClick={onClick}
    >
      {children}
      {onRemove && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:bg-black/10 rounded-full p-0.5"
        >
          <i className="ri-close-line text-xs"></i>
        </button>
      )}
    </div>
  );
}
