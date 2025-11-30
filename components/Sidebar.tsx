
import React from 'react';
import { Package, Truck, BarChart3, LayoutDashboard, Users } from 'lucide-react';

interface SidebarProps {
  currentView: 'dashboard' | 'inventory' | 'shipments' | 'dealers';
  onChangeView: (view: 'dashboard' | 'inventory' | 'shipments' | 'dealers') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { id: 'dashboard', label: '總覽', icon: LayoutDashboard },
    { id: 'inventory', label: '庫存', icon: Package },
    { id: 'shipments', label: '出貨', icon: Truck },
    { id: 'dealers', label: '經銷商', icon: Users },
  ] as const;

  return (
    <>
      {/* Desktop Sidebar (Left) */}
      <div className="hidden md:flex w-64 bg-[#2C3333] text-white flex-col fixed left-0 top-0 shadow-2xl z-50 rounded-r-3xl my-2 ml-2 h-[calc(100vh-16px)]">
        <div className="p-8">
          <h1 className="text-2xl font-bold flex items-center gap-3 text-[#E7F6F2]">
            <div className="bg-[#A5C9CA] p-2 rounded-xl text-[#2C3333]">
              <BarChart3 size={24} />
            </div>
            OmniStock
          </h1>
          <p className="text-xs text-[#A5C9CA] mt-2 tracking-wider ml-1">智慧庫存系統</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${
                  isActive
                    ? 'bg-[#E7F6F2] text-[#2C3333] shadow-lg shadow-[#A5C9CA]/20 translate-x-2'
                    : 'text-[#A5C9CA] hover:bg-[#395B64] hover:text-white'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-[#2C3333]' : 'text-[#A5C9CA] group-hover:text-white'} />
                <span className="font-medium tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-6 mt-auto">
          <div className="bg-[#395B64] rounded-2xl p-4 flex items-center gap-3 shadow-inner">
            <div className="w-3 h-3 bg-[#A5C9CA] rounded-full animate-pulse shadow-[0_0_8px_#A5C9CA]"></div>
            <span className="text-sm font-medium text-[#E7F6F2]">系統連線正常</span>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 px-6 py-3 pb-safe">
        <div className="flex justify-between items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                  isActive ? 'text-[#395B64] -translate-y-2' : 'text-slate-400'
                }`}
              >
                <div className={`p-3 rounded-2xl transition-all ${
                  isActive ? 'bg-[#E7F6F2] shadow-md' : 'bg-transparent'
                }`}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
