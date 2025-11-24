import React from 'react';
import { 
  RadialBarChart, RadialBar, Cell, ResponsiveContainer
} from 'recharts';
import { CheckCircle2, Settings } from 'lucide-react';
import BentoCard from '../../components/BentoCard';

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-100 shadow-xl rounded-xl p-3">
        <p className="text-xs font-semibold text-slate-800 mb-1 uppercase tracking-wide">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color || '#8b5cf6' }}
              />
              <span className="text-xs text-slate-600">{entry.name || 'Value'}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">
              {entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// 유리 질감의 카드 컴포넌트
const BentoCardWrapper = ({ children, className, delay = 0, title, icon: Icon }: any) => {
  const delayClass = delay > 0 ? `animate-card-enter-delay-${Math.round(delay * 10)}` : 'animate-card-enter';
  
  return (
    <div
      className={`bg-white rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col ${delayClass} ${className}`}
    >
      {title && (
        <div className="px-6 pt-6 pb-2 flex items-center gap-2 mb-2">
          <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
            <Icon size={18} />
          </div>
          <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">{title}</h3>
        </div>
      )}
      <div className="flex-1 px-6 pb-6 relative">
        {children}
      </div>
    </div>
  );
};

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-end animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              서비스 설정
            </h1>
            <p className="text-slate-500 mt-1">시스템 설정 및 데이터 품질 관리</p>
          </div>
        </header>

        {/* Data Quality Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BentoCardWrapper className="md:col-span-2" title="데이터 품질 진단" icon={CheckCircle2} delay={0.1}>
            <div className="h-full flex flex-col items-center justify-center">
              {/* Radial Bar Chart (Gauge) */}
              <div className="w-full h-64 relative mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="70%"
                    outerRadius="100%"
                    data={[
                      {
                        name: 'score',
                        value: 92,
                        fill: '#10b981'
                      },
                      {
                        name: 'remaining',
                        value: 8,
                        fill: '#e5e7eb'
                      }
                    ]}
                    startAngle={180}
                    endAngle={0}
                  >
                    <RadialBar
                      dataKey="value"
                      cornerRadius={10}
                    >
                      {[
                        { name: 'score', value: 92, fill: '#10b981' },
                        { name: 'remaining', value: 8, fill: '#e5e7eb' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </RadialBar>
                  </RadialBarChart>
                </ResponsiveContainer>
                
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-5xl font-bold text-slate-900">92</div>
                  <div className="text-sm font-semibold text-emerald-600 mt-1">우수</div>
                </div>
              </div>
              
              {/* Checklist */}
              <div className="w-full space-y-3 px-4">
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                  <span className="flex-1">프로필 완성도: 98%</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                  <span className="flex-1">연락처 유효성: 99%</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                  <span className="flex-1">마케팅 수신 동의: 85%</span>
                </div>
              </div>
            </div>
          </BentoCardWrapper>
        </div>

      </div>
    </div>
  );
}

