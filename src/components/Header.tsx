import React, { useState } from 'react';

interface HeaderProps {
  isOffline: boolean;
  onToggleOffline: () => void;
  lastSyncedText: string;
  onSync: () => void;
  isSyncing: boolean;
  onOpenEmergency: () => void;
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOffline,
  onToggleOffline,
  lastSyncedText,
  onSync,
  isSyncing,
  onOpenEmergency,
  onOpenProfile,
}) => {
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  const handleSyncClick = () => {
    onSync();
    setShowSyncSuccess(true);
    setTimeout(() => setShowSyncSuccess(false), 2500);
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl shadow-xs border-b border-slate-200">
        <div className="h-16 px-4 md:px-8 max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <span className="material-symbols-outlined text-[20px]">
                health_and_safety
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl text-slate-900 tracking-tight leading-tight">
                ArogyaDisha
              </span>
              <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
                Clinical Field Ops
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenProfile}
              id="user-profile-btn"
              title="Health Worker Profile"
              className="w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 transition-colors flex items-center justify-center text-white shadow-xs ring-2 ring-slate-100 cursor-pointer active:scale-95 text-xs font-bold"
            >
              PN
            </button>
          </div>
        </div>

        {/* Sync status strip */}
        <div className="h-8 bg-slate-50 px-4 md:px-8 border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
            <button
              onClick={handleSyncClick}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer group"
              title="Click to trigger manual sync"
            >
              <span
                className={`material-symbols-outlined text-[15px] text-slate-400 group-hover:text-indigo-600 ${
                  isSyncing ? 'animate-spin text-indigo-600' : ''
                }`}
              >
                sync
              </span>
              <span>
                {isSyncing
                  ? 'Syncing clinical data...'
                  : showSyncSuccess
                  ? '✓ Sync complete'
                  : lastSyncedText}
              </span>
            </button>

            <span className="text-[11px] font-medium text-slate-500 hidden sm:inline-block">
              PHC Rampur • Dr. Priya Nair (MO)
            </span>
          </div>
        </div>
      </header>

      {/* Floating control bar */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-md bg-white rounded-full shadow-md px-3.5 py-1.5 flex items-center justify-between border border-slate-200 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleOffline}
            id="network-toggle-btn"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer border ${
              isOffline
                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isOffline ? 'wifi_off' : 'signal_wifi_4_bar'}
            </span>
            <span>{isOffline ? 'Offline Mode' : 'Live Sync'}</span>
          </button>
        </div>

        <button
          onClick={onOpenEmergency}
          id="emergency-sos-header-btn"
          className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[15px] text-white animate-pulse">
            emergency
          </span>
          <span>108 Emergency</span>
        </button>
      </div>
    </>
  );
};

