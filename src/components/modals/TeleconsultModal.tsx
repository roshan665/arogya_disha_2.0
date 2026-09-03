import React, { useState } from 'react';
import { Patient } from '../../types';

interface TeleconsultModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: Patient;
}

export const TeleconsultModal: React.FC<TeleconsultModalProps> = ({
  isOpen,
  onClose,
  patient,
}) => {
  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended'>('connected');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [consultNotes, setConsultNotes] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 text-white rounded-xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col h-[520px] border border-slate-700">
        {/* Call Header */}
        <div className="p-4 bg-slate-800 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <span className="material-symbols-outlined text-[20px]">video_camera_front</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Dr. Arvind Mehta (District Pulmonologist)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </h3>
              <p className="text-xs text-slate-400">
                Patient: {patient?.name || 'Rajeev Sharma'} ({patient?.patientId || '8892-A'})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Video Canvas Simulation */}
        <div className="flex-1 bg-slate-950 relative flex items-center justify-center overflow-hidden">
          {/* Main Remote Video */}
          <div className="text-center space-y-3 z-10">
            <div className="w-24 h-24 rounded-full bg-indigo-950/80 border-2 border-indigo-500 flex items-center justify-center mx-auto text-3xl font-bold text-indigo-300 shadow-xl">
              AM
            </div>
            <p className="text-sm font-semibold text-white">Dr. Arvind Mehta • District Hospital Hub</p>
            <p className="text-xs text-emerald-400">Encrypted HD Audio & Telemetry Active</p>
          </div>

          {/* Picture-in-picture Self View */}
          <div className="absolute bottom-4 right-4 w-32 h-24 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center z-20 shadow-lg">
            {isVideoOff ? (
              <span className="material-symbols-outlined text-slate-500">videocam_off</span>
            ) : (
              <div className="text-center">
                <span className="material-symbols-outlined text-indigo-400 text-2xl">person</span>
                <p className="text-[10px] text-slate-400">PHC Field Camera</p>
              </div>
            )}
          </div>

          {/* Live Vitals Overlay */}
          <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs rounded-lg p-2.5 text-[11px] space-y-1 z-20 border border-slate-700">
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Patient Telemetry</div>
            <div className="flex gap-3 text-white">
              <span>BP: <strong>{patient?.vitals.bp || '138/88'}</strong></span>
              <span>SpO2: <strong className="text-emerald-400">{patient?.vitals.spo2 || '97%'}</strong></span>
              <span>Pulse: <strong>{patient?.vitals.pulse || '78'}</strong></span>
            </div>
          </div>
        </div>

        {/* Call Controls Toolbar */}
        <div className="p-4 bg-slate-800 flex items-center justify-between border-t border-slate-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-lg cursor-pointer transition-all ${
                isMuted ? 'bg-rose-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isMuted ? 'mic_off' : 'mic'}
              </span>
            </button>

            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`p-3 rounded-lg cursor-pointer transition-all ${
                isVideoOff ? 'bg-rose-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isVideoOff ? 'videocam_off' : 'videocam'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">call_end</span>
              <span>End Consult</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
