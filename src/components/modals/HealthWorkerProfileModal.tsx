import React from 'react';

interface HealthWorkerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  onSync: () => void;
  isSyncing: boolean;
}

export const HealthWorkerProfileModal: React.FC<HealthWorkerProfileModalProps> = ({
  isOpen,
  onClose,
  isOffline,
  onToggleOffline,
  onSync,
  isSyncing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
        <div className="flex justify-between items-start pb-2 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-xs">
              PN
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Dr. Priya Nair, MBBS</h2>
              <p className="text-xs text-slate-500">Medical Officer • PHC Rampur</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Credentials & System Info */}
        <div className="space-y-2.5 text-xs text-slate-700">
          <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500">ABHA Healthcare Provider ID:</span>
              <span className="font-mono font-bold text-slate-900">HPR-8821-4402</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Facility NIN Code:</span>
              <span className="font-mono font-bold text-slate-900">NIN-PHC-11092</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sub-Center Catchment:</span>
              <span className="font-semibold text-slate-900">Rampur, Kalyanpur, Shantipura</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-900">Offline Operational Mode</span>
              <button
                onClick={onToggleOffline}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isOffline ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {isOffline ? 'Offline Active' : 'Online Sync Active'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              When working in remote areas without cellular signal, all changes are saved locally with SHA-256 tamper verification.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-200">
            <div>
              <p className="font-semibold text-slate-900">Local Storage Footprint</p>
              <p className="text-[11px] text-slate-500">142 Patient Encounters Cached (2.4 MB)</p>
            </div>
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
            >
              {isSyncing ? 'Syncing...' : 'Force Sync'}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
