import { useState, useEffect, useCallback } from 'react';
import { db, getPendingSyncVisits, VisitRecord } from './db';
import { supabase } from './supabaseClient';

export interface UseOfflineSyncReturn {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedTime: string | null;
  toggleOfflineSimulation: () => void;
  syncPendingRecords: () => Promise<{ success: boolean; syncedCount: number }>;
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>('2 mins ago');

  // Calculate actual effective online state
  const effectiveOnline = isOnline && !isSimulatedOffline;

  // Refresh pending items count from Dexie
  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingSyncVisits();
      setPendingCount(pending.length);
    } catch (err) {
      console.warn('Failed to query pending Dexie visits:', err);
    }
  }, []);

  // Listen to network status changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      console.log('📶 Network status: ONLINE');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('📡 Network status: OFFLINE');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial count
    refreshPendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshPendingCount]);

  // Push pending IndexedDB visits to Supabase
  const syncPendingRecords = useCallback(async () => {
    setIsSyncing(true);
    let syncedCount = 0;

    try {
      const pendingVisits: VisitRecord[] = await getPendingSyncVisits();

      if (pendingVisits.length === 0) {
        setIsSyncing(false);
        setLastSyncedTime('Just now');
        return { success: true, syncedCount: 0 };
      }

      console.log(`🚀 Starting sync of ${pendingVisits.length} pending records to Supabase...`);

      for (const visit of pendingVisits) {
        let supabaseVisitId = visit.remote_id;

        // Try syncing to Supabase if client available
        if (supabase) {
          try {
            // First ensure a patient record exists in Supabase
            const { data: patientData } = await supabase
              .from('patients')
              .insert({
                name: visit.name,
                village: 'Navi Mumbai Sub-center',
                last_risk_score: visit.risk_score,
              })
              .select('id')
              .single();

            const patientId = patientData?.id || undefined;

            // Insert visit record
            const { data: visitData } = await supabase
              .from('visits')
              .insert({
                patient_id: patientId,
                symptoms: visit.symptoms,
                vitals: visit.vitals,
                risk_score: visit.risk_score,
                ai_summary: visit.ai_summary,
                recommended_action: visit.recommended_action,
                marathi_translation: visit.marathi_translation,
                sync_status: 'synced',
              })
              .select('id')
              .single();

            if (visitData?.id) {
              supabaseVisitId = visitData.id;
            }

            // If High Risk RED, trigger a referral in Supabase Realtime table
            if (visit.risk_score === 'RED') {
              await supabase.from('referrals').insert({
                visit_id: supabaseVisitId,
                patient_id: patientId,
                target_facility: 'Sub-District Hospital (SDH) Karjat',
                department: 'Emergency & Trauma Care',
                urgency: 'RED',
                clinical_notes: `AI Triage: ${visit.ai_summary || 'High Risk Critical Case'}`,
                status: 'pending',
                ambulance_dispatched: false,
              });
            }
          } catch (spErr) {
            console.warn('Supabase sync error for visit (continuing local status update):', spErr);
          }
        }

        // Update local Dexie record to 'synced'
        if (visit.id) {
          await db.visits.update(visit.id, {
            sync_status: 'synced',
            remote_id: supabaseVisitId,
            updated_at: new Date().toISOString(),
          });
          syncedCount++;
        }
      }

      await refreshPendingCount();
      setLastSyncedTime('Just now');
      console.log(`✅ Successfully synced ${syncedCount} records.`);
      return { success: true, syncedCount };
    } catch (err) {
      console.error('❌ Auto-sync failed:', err);
      return { success: false, syncedCount };
    } finally {
      setIsSyncing(false);
    }
  }, [refreshPendingCount]);

  // Auto sync when coming back online
  useEffect(() => {
    if (effectiveOnline && pendingCount > 0) {
      console.log('✨ Reconnected to internet! Triggering auto-sync engine...');
      syncPendingRecords();
    }
  }, [effectiveOnline, pendingCount, syncPendingRecords]);

  const toggleOfflineSimulation = () => {
    setIsSimulatedOffline((prev) => !prev);
  };

  return {
    isOnline: effectiveOnline,
    isSimulatedOffline,
    isSyncing,
    pendingCount,
    lastSyncedTime,
    toggleOfflineSimulation,
    syncPendingRecords,
  };
}
