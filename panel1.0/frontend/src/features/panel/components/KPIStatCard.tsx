import React from 'react';

interface KPIStatCardProps {
  icon: string;
  title: string;
  value: string;
  subtitle?: string;
  bgColor?: 'violet' | 'indigo' | 'pink';
}

export const KPIStatCard: React.FC<KPIStatCardProps> = ({
  icon,
  title,
  value,
  subtitle,
  bgColor = 'violet'
}) => {
  const colorClasses = {
    violet: {
      iconBg: 'bg-[#f0f2ff]',
      iconText: 'text-[#7c5cff]',
      cardBg: 'bg-white',
      titleText: 'text-gray-500'
    },
    indigo: {
      iconBg: 'bg-[#eaf7ff]',
      iconText: 'text-[#4aa3ff]',
      cardBg: 'bg-white',
      titleText: 'text-gray-500'
    },
    pink: {
      iconBg: 'bg-white',
      iconText: 'text-[#ff6b8b]',
      cardBg: 'bg-[#fff5f7]',
      titleText: 'text-[#ff6b8b]'
    }
  };

  const colors = colorClasses[bgColor];

  return (
    <div className={`${colors.cardBg} rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full ${colors.iconBg} flex items-center justify-center ${colors.iconText}`}>
            {icon}
          </div>
          <span className={`text-xs ${colors.titleText} ${bgColor === 'pink' ? 'font-medium' : ''}`}>
            {title}
          </span>
        </div>
        {subtitle && (
          <span className="text-[10px] text-gray-400">
            {subtitle}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-gray-900">
          {value}
        </span>
      </div>
    </div>
  );
};

