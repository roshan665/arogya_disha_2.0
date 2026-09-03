'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { AshaView } from '../../components/AshaView';
import { useOfflineSync } from '../../lib/useOfflineSync';

export default function AshaPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login');
      } else {
        setUser(data.user);
      }
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined animate-spin text-emerald-400">sync</span>
          <span className="text-sm font-semibold">Loading ASHA Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <AshaView
      isOffline={!isOnline}
      onToggleOffline={toggleOfflineSimulation}
      isSyncing={isSyncing}
      onSync={syncPendingRecords}
      lastSyncedText={lastSyncedTime ? `Last synced: ${lastSyncedTime}` : 'Synced'}
    />
  );
}
