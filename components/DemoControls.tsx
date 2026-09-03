import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { saveVisitOffline } from '../lib/db';

interface DemoControlsProps {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  onToggleOffline: () => void;
  pendingCount: number;
  onSync: () => Promise<any>;
  isSyncing: boolean;
  onMockAlertTriggered?: (referral: any) => void;
}

export const DemoControls: React.FC<DemoControlsProps> = ({
  isOnline,
  isSimulatedOffline,
  onToggleOffline,
  pendingCount,
  onSync,
  isSyncing,
  onMockAlertTriggered,
}) => {
  const [isTriggering, setIsTriggering] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleTriggerMockRedAlert = async () => {
    setIsTriggering(true);
    const timestamp = new Date().toISOString();
    const mockReferralId = 'ref-' + Math.floor(1000 + Math.random() * 9000);

    const mockPatientData = {
      id: mockReferralId,
      patient_id: 'p-' + Math.floor(1000 + Math.random() * 9000),
      patient_name: 'Rajesh Shivaji Patil',
      age: 58,
      gender: 'M' as const,
      village: 'Wadgaon Phata (Sub-center)',
      urgency: 'RED' as const,
      risk_score: 'RED' as const,
      symptoms: ['Acute Severe Chest Pain', 'SpO2 84%', 'Cold Diaphoresis', 'Shortness of Breath'],
      vitals: {
        bp_systolic: 192,
        bp_diastolic: 118,
        heart_rate: 124,
        spo2: 84,
        temperature: 99.1,
      },
      ai_summary:
        'CRITICAL ALERT: Patient displaying signs of Acute Coronary Syndrome (ACS) with Hypertensive Crisis (192/118 mmHg) and severe arterial hypoxia (SpO2 84%). Immediate 108 Emergency Transport required.',
      recommended_action:
        '1. High-flow O2 therapy (4-6 L/min). 2. Administer Sublingual Nitroglycerin if SBP > 90. 3. Dispatch 108 ALS Ambulance immediately to Sub-District Hospital Karjat.',
      marathi_translation:
        'अतिदक्षता इशारा: रुग्णाला छातीत तीव्र वेदना आणि ऑक्सिजनची पातळी ८४% वर घसरली आहे. तात्काळ १०८ रुग्णवाहिका बोलवून उपजिल्हा रुग्णालयात हलवा.',
      target_facility: 'Sub-District Hospital (SDH) Karjat - Trauma Unit',
      department: 'Cardiology & Emergency Care',
      status: 'pending',
      created_at: timestamp,
      referring_worker: 'ASHA Worker Sunita Deshmukh (ID: AS-402)',
    };

    try {
      // 1. If online, attempt to insert into Supabase referrals table
      if (isOnline && supabase) {
        try {
          await supabase.from('referrals').insert({
            target_facility: mockPatientData.target_facility,
            department: mockPatientData.department,
            urgency: 'RED',
            clinical_notes: mockPatientData.ai_summary,
            status: 'pending',
          });
        } catch (e) {
          console.warn('Supabase mock insertion info (proceeding with local dispatch):', e);
        }
      } else {
        // Save to offline IndexedDB
        await saveVisitOffline({
          name: mockPatientData.patient_name,
          symptoms: mockPatientData.symptoms,
          vitals: mockPatientData.vitals,
          risk_score: 'RED',
          ai_summary: mockPatientData.ai_summary,
          recommended_action: mockPatientData.recommended_action,
          marathi_translation: mockPatientData.marathi_translation,
          sync_status: 'pending',
        });
      }

      // 2. Dispatch custom event for real-time listener across components
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('arogya-mock-red-alert', { detail: mockPatientData });
        window.dispatchEvent(event);
      }

      if (onMockAlertTriggered) {
        onMockAlertTriggered(mockPatientData);
      }

      showToast('🚨 Mock RED Emergency Alert Triggered!');
    } catch (err) {
      console.error('Failed to trigger mock RED alert:', err);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <>
      {/* Toast popup */}
      {toast && (
        <div className="fixed bottom-24 right-6 z-[100] bg-red-950 border border-red-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span>{toast}</span>
        </div>
      )}

      {/* Floating Demo Control Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[95] w-[95%] max-w-4xl bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl shadow-2xl p-2.5 md:p-3 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">tune</span>
              Demo Control
            </span>
          </div>

          {/* Network Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>{isOnline ? 'Online (Supabase Active)' : 'Offline (Local Dexie)'}</span>
          </div>

          {/* Pending Queue Count */}
          {pendingCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-200 border border-amber-500/30">
              <span className="material-symbols-outlined text-[14px]">cloud_queue</span>
              {pendingCount} Pending Sync
            </span>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Network Toggle Button */}
          <button
            onClick={onToggleOffline}
            type="button"
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
              isSimulatedOffline
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-900/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
            }`}
            title="Simulate offline or online network state"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isSimulatedOffline ? 'wifi' : 'wifi_off'}
            </span>
            <span>{isSimulatedOffline ? 'Go Online' : 'Simulate Offline'}</span>
          </button>

          {/* Sync Now Button */}
          <button
            onClick={onSync}
            disabled={isSyncing}
            type="button"
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600/90 hover:bg-indigo-500 text-white border border-indigo-400/40 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
            title="Push offline IndexedDB records to Supabase"
          >
            <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin' : ''}`}>
              sync
            </span>
            <span>{isSyncing ? 'Syncing...' : 'Sync Queue'}</span>
          </button>

          {/* Trigger Mock RED Alert Button */}
          <button
            onClick={handleTriggerMockRedAlert}
            disabled={isTriggering}
            type="button"
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border border-red-400/50 shadow-lg shadow-red-900/50 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer animate-pulse"
            title="Simulate incoming RED Emergency Referral to test Doctor's realtime feed"
          >
            <span className="material-symbols-outlined text-[18px]">warning</span>
            <span>{isTriggering ? 'Dispatching...' : 'Trigger Mock RED Alert'}</span>
          </button>
        </div>
      </div>
    </>
  );
};
