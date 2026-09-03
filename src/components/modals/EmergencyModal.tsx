import React, { useState } from 'react';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({ isOpen, onClose }) => {
  const [dispatchStatus, setDispatchStatus] = useState<'idle' | 'calling' | 'dispatched'>('idle');
  const [ambulanceEta, setAmbulanceEta] = useState(14);

  if (!isOpen) return null;

  const handleTriggerAmbulance = () => {
    setDispatchStatus('calling');
    setTimeout(() => {
      setDispatchStatus('dispatched');
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-5 border-t-4 border-rose-600 border-x border-b border-slate-200 animate-scaleUp">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 animate-bounce">
              <span className="material-symbols-outlined text-[28px]">emergency</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-rose-700 tracking-tight">Emergency SOS Dispatch Hub</h2>
              <p className="text-xs text-slate-500">Rampur Sector • Rapid Resuscitation & 108 Dispatch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 108 Ambulance Dispatch Section */}
        <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-sm text-rose-900 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">ambulance</span>
              <span>108 National Ambulance Service</span>
            </span>
            <span className="text-[11px] font-bold text-rose-700 bg-white border border-rose-200 px-2 py-0.5 rounded-full">
              GPS Active
            </span>
          </div>

          {dispatchStatus === 'idle' && (
            <div>
              <p className="text-xs text-slate-700 mb-3 leading-relaxed">
                Broadcast current GPS coordinates (PHC Rampur: 28.6139° N, 77.2090° E) for immediate emergency ALS ambulance pickup.
              </p>
              <button
                onClick={handleTriggerAmbulance}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-lg font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[20px]">e911_emergency</span>
                <span>Dispatch Nearest ALS Ambulance (108)</span>
              </button>
            </div>
          )}

          {dispatchStatus === 'calling' && (
            <div className="py-4 text-center space-y-2">
              <span className="material-symbols-outlined text-3xl text-rose-600 animate-spin">
                sync
              </span>
              <p className="text-xs font-semibold text-rose-700">
                Transmitting emergency telemetry to District Dispatch Hub...
              </p>
            </div>
          )}

          {dispatchStatus === 'dispatched' && (
            <div className="bg-white p-3 rounded-lg border border-rose-200 space-y-2 shadow-xs">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Ambulance #KA-04-E-1082 Assigned</span>
                </span>
                <span className="font-bold text-rose-700">ETA: {ambulanceEta} Mins</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Driver: Rameshwar Singh (+91 98877 66554) • Oxygen & Defibrillator on-board
              </p>
            </div>
          )}
        </div>

        {/* Emergency Resuscitation Checklist */}
        <div className="space-y-2">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
            Immediate Stabilizing Protocol (PHC Standard)
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2 text-slate-800">
              <span className="material-symbols-outlined text-indigo-600 text-[18px]">air</span>
              <span>Airway & High-flow O2</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2 text-slate-800">
              <span className="material-symbols-outlined text-indigo-600 text-[18px]">water_drop</span>
              <span>IV Access (18G Cannula)</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2 text-slate-800">
              <span className="material-symbols-outlined text-indigo-600 text-[18px]">ecg_heart</span>
              <span>Continuous ECG & SpO2</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2 text-slate-800">
              <span className="material-symbols-outlined text-indigo-600 text-[18px]">medication</span>
              <span>Emergency Drug Tray</span>
            </div>
          </div>
        </div>

        {/* Action Footers */}
        <div className="pt-2 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors border border-slate-200"
          >
            Close Emergency Panel
          </button>
        </div>
      </div>
    </div>
  );
};
