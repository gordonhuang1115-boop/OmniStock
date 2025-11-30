
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon: Icon, color }) => {
  // Morandi colors map
  const styles = {
    indigo: { bg: 'bg-[#E7F6F2]', text: 'text-[#395B64]', iconBg: 'bg-[#395B64] text-white' },
    emerald: { bg: 'bg-[#EBF7F2]', text: 'text-[#5F8D76]', iconBg: 'bg-[#5F8D76] text-white' },
    amber:   { bg: 'bg-[#FEF5EB]', text: 'text-[#C99C73]', iconBg: 'bg-[#C99C73] text-white' },
    rose:    { bg: 'bg-[#F9EBEB]', text: 'text-[#B87C7C]', iconBg: 'bg-[#B87C7C] text-white' },
  };

  const currentStyle = styles[color];

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100/50 flex items-start justify-between hover:shadow-md transition-shadow duration-300">
      <div>
        <p className="text-sm font-medium text-slate-400 mb-2">{title}</p>
        <h3 className="text-3xl font-bold text-[#2C3333] tracking-tight">{value}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-2 font-medium">{subtitle}</p>}
      </div>
      <div className={`p-4 rounded-2xl shadow-lg shadow-black/5 ${currentStyle.iconBg}`}>
        <Icon size={24} />
      </div>
    </div>
  );
};
