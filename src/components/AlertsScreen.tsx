import React, { useState } from 'react';
import { AlertNotification, SyncItem } from '../types';

interface AlertsScreenProps {
  alerts: AlertNotification[];
  syncItems: SyncItem[];
  isOffline: boolean;
  onSync: () => void;
  isSyncing: boolean;
  onOpenEmergency: () => void;
}

export const AlertsScreen: React.FC<AlertsScreenProps> = ({
  alerts,
  syncItems,
  isOffline,
  onSync,
  isSyncing,
  onOpenEmergency,
}) => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'sync'>('alerts');
  const [alertList, setAlertList] = useState<AlertNotification[]>(alerts);

  const toggleResolve = (id: string) => {
    setAlertList(
      alertList.map((a) => (a.id === id ? { ...a, resolved: !a.resolved } : a))
    );
  };

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-2 md:py-6 gap-6">
      {/* Top Banner / Hero */}
      <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <span className="material-symbols-outlined text-rose-600">warning</span>
            <span>Alerts & Sync Operations Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Epidemic surveillance, high-risk flags, cold chain monitoring & offline ledger
          </p>
        </div>

        <button
          onClick={onOpenEmergency}
          className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] animate-pulse">emergency</span>
          <span>108 Emergency Dispatch</span>
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'alerts'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">notifications_active</span>
          <span>Clinical & Field Alerts ({alertList.filter((a) => !a.resolved).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'sync'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">cloud_sync</span>
          <span>Offline Sync Queue ({syncItems.filter((s) => s.status === 'pending').length} Pending)</span>
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'alerts' ? (
        <div className="space-y-3">
          {alertList.map((alert) => {
            const isCritical = alert.priority === 'critical';

            return (
              <div
                key={alert.id}
                className={`bg-white rounded-xl p-4 shadow-xs border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                  alert.resolved
                    ? 'opacity-60 border-slate-200 bg-slate-50'
                    : isCritical
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                      isCritical
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : alert.type === 'vaccine'
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {isCritical
                        ? 'emergency'
                        : alert.type === 'vaccine'
                        ? 'ac_unit'
                        : 'notifications'}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{alert.title}</h3>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {alert.timestamp}
                      </span>
                    </div>
                    {alert.patientName && (
                      <p className="text-xs font-semibold text-indigo-600 mt-0.5">
                        Patient: {alert.patientName}
                      </p>
                    )}
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {alert.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    onClick={() => toggleResolve(alert.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                      alert.resolved
                        ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-600 hover:text-white'
                    }`}
                  >
                    {alert.resolved ? 'Mark Unresolved' : 'Acknowledge & Resolve'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-white">Local Encrypted SQLite Storage Engine</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isOffline
                  ? 'App is operating offline. All clinical encounters stored locally.'
                  : 'High-speed sync active. Telemetry linked to District HMIS server.'}
              </p>
            </div>
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
            >
              <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{isSyncing ? 'Syncing...' : 'Sync All Records'}</span>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 grid grid-cols-12 uppercase tracking-wider">
              <span className="col-span-3">Action Type</span>
              <span className="col-span-5">Record Details</span>
              <span className="col-span-2">Timestamp</span>
              <span className="col-span-2 text-right">Sync State</span>
            </div>

            <div className="divide-y divide-slate-100">
              {syncItems.map((item) => (
                <div key={item.id} className="p-3.5 text-xs text-slate-900 grid grid-cols-12 items-center">
                  <span className="col-span-3 font-semibold text-indigo-600">{item.type}</span>
                  <span className="col-span-5 text-slate-600">{item.description}</span>
                  <span className="col-span-2 text-slate-500">{item.timestamp}</span>
                  <span className="col-span-2 text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        item.status === 'synced'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        {item.status === 'synced' ? 'check' : 'schedule'}
                      </span>
                      <span>{item.status === 'synced' ? 'Synced' : 'Pending'}</span>
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

