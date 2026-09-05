import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Referral } from '../repositories/ReferralRepository';

export function useRealtimeReferrals(facilityId: string) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityId) return;

    // 1. Initial Fetch
    const fetchInitial = async () => {
      try {
        const { data, error } = await supabase
          .from('referrals')
          .select('*')
          .eq('destination_facility_id', facilityId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setReferrals(data as Referral[]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();

    // 2. Real-time Subscription
    const subscription = supabase
      .channel(`facility_referrals_${facilityId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'referrals',
          filter: `destination_facility_id=eq.${facilityId}`
        },
        (payload) => {
          setReferrals((current) => {
            if (payload.eventType === 'INSERT') {
              return [payload.new as Referral, ...current];
            } else if (payload.eventType === 'UPDATE') {
              return current.map(ref => ref.id === payload.new.id ? (payload.new as Referral) : ref);
            } else if (payload.eventType === 'DELETE') {
              return current.filter(ref => ref.id !== payload.old.id);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [facilityId]);

  return { referrals, loading, error };
}
