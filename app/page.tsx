'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useOfflineSync } from '../lib/useOfflineSync';
import { createClient } from '../lib/supabase/client';
import { AshaView } from '../components/AshaView';
import { DoctorView } from '../components/DoctorView';
import { AdminView } from '../components/AdminView';

export type UserRole = 'ASHA' | 'DOCTOR' | 'ADMIN';

export default function HomePage() {
  const [activeRole, setActiveRole] = useState<UserRole>('ASHA');
  const [user, setUser] = useState<any>(null);
  const [showDemoSheet, setShowDemoSheet] = useState(false);

  const {
    isOnline,
    isSimulatedOffline,
    isSyncing,
    pendingCount,
    lastSyncedTime,
    toggleOfflineSimulation,
    syncPendingRecords,
  } = useOfflineSync();

  useEffect(() => {
    const supabase = createClient();

    // Check active session
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        const roleMeta = data.user.user_metadata?.role;
        if (roleMeta === 'mo_doctor') setActiveRole('DOCTOR');
        else if (roleMeta === 'admin') setActiveRole('ADMIN');
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleTriggerMockRedAlert = () => {
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

    if (typeof window !== 'undefined') {
      const event = new CustomEvent('arogya-mock-red-alert', { detail: mockPatientData });
      window.dispatchEvent(event);
    }

    setActiveRole('DOCTOR');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center justify-start py-2 sm:py-6 px-2">
      {/* Integrated Native Mobile Container Header Controls */}
      <div className="w-full max-w-md bg-white rounded-3xl p-3 shadow-md border border-slate-200 mb-3 space-y-2.5">
        {/* Top Branding & Auth Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
              AD
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-slate-900 tracking-tight leading-none">
                ArogyaDisha
              </h1>
              <span className="text-[10px] font-semibold text-slate-500">
                Rural AI Triage & Telemedicine
              </span>
            </div>
          </div>

          {/* User Auth or Sign In Button */}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                {user.user_metadata?.full_name || 'User'}
              </span>
              <button
                onClick={handleSignOut}
                className="text-[11px] font-bold text-slate-500 hover:text-rose-600 px-1.5 py-0.5"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-full transition-all shadow-xs"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-full border border-slate-200"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Clean Role Switcher Bar */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => setActiveRole('ASHA')}
            type="button"
            className={`py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeRole === 'ASHA'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">stethoscope</span>
            <span>ASHA</span>
          </button>

          <button
            onClick={() => setActiveRole('DOCTOR')}
            type="button"
            className={`py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer relative ${
              activeRole === 'DOCTOR'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">medical_services</span>
            <span>Doctor / MO</span>
          </button>

          <button
            onClick={() => setActiveRole('ADMIN')}
            type="button"
            className={`py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeRole === 'ADMIN'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">monitoring</span>
            <span>Admin</span>
          </button>
        </div>

        {/* Integrated Network & Demo Action Toolbar */}
        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 text-[11px]">
          {/* Network State Badge */}
          <button
            onClick={toggleOfflineSimulation}
            type="button"
            className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 border transition-all cursor-pointer ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </button>

          {/* Sync Button */}
          <button
            onClick={syncPendingRecords}
            disabled={isSyncing}
            type="button"
            className="px-2.5 py-1 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[14px] ${isSyncing ? 'animate-spin' : ''}`}>
              sync
            </span>
            <span>Sync {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
          </button>

          {/* Trigger Mock RED Alert Button */}
          <button
            onClick={handleTriggerMockRedAlert}
            type="button"
            className="px-2.5 py-1 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center gap-1 cursor-pointer animate-pulse"
          >
            <span className="material-symbols-outlined text-[14px]">warning</span>
            <span>Mock RED Alert</span>
          </button>
        </div>
      </div>

      {/* Main Active Role View */}
      <div className="w-full">
        {activeRole === 'ASHA' && (
          <AshaView
            isOffline={!isOnline}
            onToggleOffline={toggleOfflineSimulation}
            isSyncing={isSyncing}
            onSync={syncPendingRecords}
            lastSyncedText={lastSyncedTime ? `Last synced: ${lastSyncedTime}` : 'Synced'}
          />
        )}

        {activeRole === 'DOCTOR' && <DoctorView />}

        {activeRole === 'ADMIN' && <AdminView />}
      </div>
    </div>
  );
}
