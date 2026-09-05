import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { QueueService } from '../services/QueueService';

export function useRealtimeQueue(facilityId: string, doctorId?: string) {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityId) return;

    const fetchQueue = async () => {
      try {
        const data = await QueueService.getLiveQueue(facilityId, doctorId);
        setQueue(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQueue();

    // Subscribe strictly to the appointments table for real-time queue shuffling
    const subscription = supabase
      .channel(`facility_queue_${facilityId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          // In a production app, we would selectively update the queue state here.
          // For absolute sorting accuracy, we re-fetch the optimized sorted list from the DB.
          fetchQueue(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [facilityId, doctorId]);

  return { queue, loading, error };
}
