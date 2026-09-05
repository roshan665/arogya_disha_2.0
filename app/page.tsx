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
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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

    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        const roleMeta = data.user.user_metadata?.role;
        if (roleMeta === 'mo_doctor' || roleMeta === 'specialist') {
            setActiveRole('DOCTOR');
        } else if (roleMeta === 'admin' || roleMeta === 'system_admin') {
            setActiveRole('ADMIN');
        } else {
            setActiveRole('ASHA'); // Default fallback for workers
        }
      } else {
        setUser(null);
        setActiveRole(null);
      }
      setIsLoading(false);
    };

    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        const roleMeta = session.user.user_metadata?.role;
        if (roleMeta === 'mo_doctor' || roleMeta === 'specialist') {
            setActiveRole('DOCTOR');
        } else if (roleMeta === 'admin' || roleMeta === 'system_admin') {
            setActiveRole('ADMIN');
        } else {
            setActiveRole('ASHA');
        }
      } else {
        setUser(null);
        setActiveRole(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setActiveRole(null);
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

        {/* Integrated Network Toolbar (Only shown when logged in) */}
        {user && (
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
            </div>
        )}
      </div>

      {/* Main Active Role View */}
      <div className="w-full">
        {isLoading ? (
            <div className="text-center py-20 text-slate-500 font-semibold text-sm">
                Loading Secure Context...
            </div>
        ) : !user ? (
            <div className="w-full max-w-md mx-auto bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center space-y-4 mt-10">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="material-symbols-outlined text-[32px] text-slate-400">lock</span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">Authentication Required</h2>
                <p className="text-sm text-slate-500">
                    ArogyaDisha uses role-based access control. Please sign in with your authorized credentials to access your dashboard.
                </p>
                <div className="pt-4">
                    <Link
                        href="/login"
                        className="inline-block text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-full transition-all shadow-md"
                    >
                        Proceed to Login
                    </Link>
                </div>
            </div>
        ) : (
            <>
                {activeRole === 'ASHA' && (
                <AshaView
                    isOffline={!isOnline}
                    onToggleOffline={toggleOfflineSimulation}
                    isSyncing={isSyncing}
                    onSync={syncPendingRecords}
                    lastSyncedText={lastSyncedTime ? `Last synced: ${lastSyncedTime}` : 'Synced'}
                    user={user}
                    onSignOut={handleSignOut}
                />
                )}
                {activeRole === 'DOCTOR' && <DoctorView />}
                {activeRole === 'ADMIN' && <AdminView />}
            </>
        )}
      </div>
    </div>
  );
}
