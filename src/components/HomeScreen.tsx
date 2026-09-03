import React from 'react';
import { ScheduleItem } from '../types';

interface HomeScreenProps {
  isOffline: boolean;
  onSync: () => void;
  isSyncing: boolean;
  schedule: ScheduleItem[];
  onToggleScheduleItem: (id: string) => void;
  onQuickAction: (actionId: 'house-visit' | 'add-patient' | 'teleconsult' | 'health-triage') => void;
  onSelectPatientByName?: (name: string) => void;
  onOpenAddSchedule: () => void;
  onOpenCriticalAlerts: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  isOffline,
  onSync,
  isSyncing,
  schedule,
  onToggleScheduleItem,
  onQuickAction,
  onSelectPatientByName,
  onOpenAddSchedule,
  onOpenCriticalAlerts,
}) => {
  const completedCount = schedule.filter((s) => s.completed).length;
  const totalCount = Math.max(schedule.length, 12);
  const progressPercent = Math.min(100, Math.round((completedCount / totalCount) * 100));

  return (
    <div className="flex flex-col w-full gap-4 max-w-lg mx-auto px-4">
      {/* Offline Sync Bar */}
      {isOffline && (
        <div
          id="offline-banner"
          className="w-full bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between shadow-xs border border-slate-800 transition-all animate-fadeIn"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]">
                wifi_off
              </span>
            </div>
            <div>
              <span className="text-sm font-semibold text-white block">Offline Mode Active</span>
              <span className="text-[11px] text-slate-400">Encrypted local SQLite ledger</span>
            </div>
          </div>
          <button
            onClick={onSync}
            id="sync-now-btn"
            disabled={isSyncing}
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            {isSyncing && (
              <span className="material-symbols-outlined text-[14px] animate-spin">
                sync
              </span>
            )}
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      )}

      {/* Key Stats Card: Daily Progress */}
      <div
        id="daily-progress-card"
        className="bg-white rounded-xl p-5 shadow-xs border border-slate-200 transition-all"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Daily Target Overview
            </p>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">Field Patient Visits</h2>
          </div>
          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md">
            Rampur Sector
          </span>
        </div>

        <div className="flex justify-between items-end mt-2">
          <div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">
              {completedCount}
              <span className="text-base font-normal text-slate-500"> / {totalCount} Completed</span>
            </p>
            <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>{progressPercent}% target completion today</span>
            </p>
          </div>

          <button
            onClick={onOpenCriticalAlerts}
            id="critical-alert-badge"
            className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95 shadow-xs"
          >
            <span className="material-symbols-outlined text-[15px] animate-pulse">
              warning
            </span>
            <span className="text-xs font-semibold">1 Critical Case</span>
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.max(progressPercent, 18)}%` }}
          ></div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="mt-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Quick Operations
          </h2>
          <span className="text-xs font-semibold text-slate-500">Field Direct</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Action 1: House Visit */}
          <button
            onClick={() => onQuickAction('house-visit')}
            id="quick-action-house-visit"
            className="bg-white hover:bg-slate-50 active:scale-[0.98] rounded-xl p-4 flex flex-col items-center justify-center gap-2 shadow-xs transition-all border border-slate-200 cursor-pointer text-center group"
          >
            <div className="w-11 h-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform border border-indigo-100">
              <span className="material-symbols-outlined text-[22px]">home</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">House Visit</span>
              <span className="text-[10px] text-slate-500">ASHA / ANM field check</span>
            </div>
          </button>

          {/* Action 2: Add Patient */}
          <button
            onClick={() => onQuickAction('add-patient')}
            id="quick-action-add-patient"
            className="bg-white hover:bg-slate-50 active:scale-[0.98] rounded-xl p-4 flex flex-col items-center justify-center gap-2 shadow-xs transition-all border border-slate-200 cursor-pointer text-center group"
          >
            <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform border border-slate-200">
              <span className="material-symbols-outlined text-[22px]">person_add</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Register Patient</span>
              <span className="text-[10px] text-slate-500">ABHA & demographic entry</span>
            </div>
          </button>

          {/* Action 3: Teleconsult */}
          <button
            onClick={() => onQuickAction('teleconsult')}
            id="quick-action-teleconsult"
            className="bg-white hover:bg-slate-50 active:scale-[0.98] rounded-xl p-4 flex flex-col items-center justify-center gap-2 shadow-xs transition-all border border-slate-200 cursor-pointer text-center group"
          >
            <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform border border-amber-200">
              <span className="material-symbols-outlined text-[22px]">phone_in_talk</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Teleconsult</span>
              <span className="text-[10px] text-slate-500">District specialist link</span>
            </div>
          </button>

          {/* Action 4: Health Triage */}
          <button
            onClick={() => onQuickAction('health-triage')}
            id="quick-action-health-triage"
            className="bg-white hover:bg-slate-50 active:scale-[0.98] rounded-xl p-4 flex flex-col items-center justify-center gap-2 shadow-xs transition-all border border-slate-200 cursor-pointer text-center group"
          >
            <div className="w-11 h-11 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center group-hover:scale-105 transition-transform border border-rose-200">
              <span className="material-symbols-outlined text-[22px]">monitor_heart</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Health Triage</span>
              <span className="text-[10px] text-slate-500">Risk flags & surveillance</span>
            </div>
          </button>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="mt-1 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Today's Scheduled Consultations
          </h2>
          <button
            onClick={onOpenAddSchedule}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Visit</span>
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {schedule.map((item) => (
            <div
              key={item.id}
              id={`schedule-item-${item.id}`}
              className={`rounded-xl p-4 shadow-xs flex items-center gap-3 border transition-all ${
                item.completed
                  ? 'bg-slate-50 border-slate-200 opacity-75'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Time Column */}
              <div className="flex flex-col items-center justify-center min-w-[48px] py-1 px-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs font-bold text-slate-900 leading-none">
                  {item.time}
                </span>
                <span className="text-[9px] font-semibold text-slate-500 tracking-wider uppercase mt-0.5">
                  {item.period}
                </span>
              </div>

              {/* Vertical Color Indicator Bar */}
              <div
                className={`w-1 self-stretch rounded-full ${
                  item.colorType === 'primary'
                    ? 'bg-indigo-600'
                    : item.colorType === 'secondary'
                    ? 'bg-slate-500'
                    : 'bg-amber-500'
                }`}
              ></div>

              {/* Content Details */}
              <div
                className="flex-1 cursor-pointer"
                onClick={() => onSelectPatientByName && onSelectPatientByName(item.patientName)}
              >
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-bold leading-snug ${item.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                    {item.patientName}
                  </h3>
                  {item.village && (
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {item.village}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <span className="material-symbols-outlined text-[14px] text-slate-400">
                    {item.icon}
                  </span>
                  <span>{item.category}</span>
                </p>
              </div>

              {/* Completion Toggle Button */}
              <button
                onClick={() => onToggleScheduleItem(item.id)}
                className={`p-1.5 rounded-lg transition-all cursor-pointer active:scale-90 ${
                  item.completed ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                }`}
                title={item.completed ? 'Mark as incomplete' : 'Mark as completed'}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {item.completed ? 'check_circle' : 'radio_button_unchecked'}
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

