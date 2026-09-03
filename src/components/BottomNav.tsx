import React from 'react';
import { TabType } from '../types';

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  unreadAlertsCount?: number;
  waitingQueueCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  unreadAlertsCount = 2,
  waitingQueueCount = 4,
}) => {
  const navItems: { id: TabType; label: string; icon: string; badge?: number }[] = [
    { id: 'home', label: 'Dashboard', icon: 'dashboard' },
    { id: 'patients', label: 'Patients', icon: 'groups' },
    { id: 'consults', label: 'Consults', icon: 'medical_services', badge: waitingQueueCount },
    { id: 'alerts', label: 'Alerts & Sync', icon: 'notifications', badge: unreadAlertsCount },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-white/95 backdrop-blur-xl shadow-[0_-1px_3px_rgba(0,0,0,0.05)] border-t border-slate-200"
    >
      <div className="max-w-md mx-auto flex justify-around items-center h-18 px-2">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 w-16 h-14 transition-all rounded-lg relative cursor-pointer active:scale-95 ${
                isActive
                  ? 'text-indigo-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <span
                  className={`material-symbols-outlined transition-transform duration-200 ${
                    isActive ? 'text-indigo-600 scale-110 font-bold' : 'text-slate-500'
                  }`}
                  style={{ fontVariationSettings: isActive ? "'FILL' 1, 'wght' 600" : "'FILL' 0, 'wght' 400" }}
                >
                  {item.icon}
                </span>

                {item.badge && item.badge > 0 && !isActive && (
                  <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] leading-tight tracking-tight ${isActive ? 'font-semibold text-indigo-600' : 'font-medium text-slate-500'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-indigo-600 mt-0.5"></div>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

