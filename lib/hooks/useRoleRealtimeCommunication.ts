import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  RealtimeRole,
  RealtimeHealthcareEvent,
  RelatedEntityType,
} from '../services/RealtimeCommunicationService';

interface UseRoleRealtimeCommunicationProps {
  role: RealtimeRole;
  userId: string;
  facilityId?: string;
  onEventReceived?: (event: RealtimeHealthcareEvent) => void;
}

export function useRoleRealtimeCommunication({
  role,
  userId,
  facilityId,
  onEventReceived,
}: UseRoleRealtimeCommunicationProps) {
  const [events, setEvents] = useState<RealtimeHealthcareEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<RealtimeHealthcareEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Initial Fetch of recent authorized events for this user/role
  const fetchRecentEvents = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('realtime_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.warn('Could not fetch historical realtime events:', error.message);
        return;
      }

      if (data) {
        const formatted: RealtimeHealthcareEvent[] = data.map((row: any) => ({
          id: row.id,
          type: row.type,
          actorId: row.actor_id,
          actorRole: row.actor_role as RealtimeRole,
          patientId: row.patient_id,
          relatedEntityId: row.related_entity_id,
          relatedEntityType: row.related_entity_type as RelatedEntityType,
          recipientType: row.recipient_type as RealtimeRole,
          recipientUserId: row.recipient_user_id || undefined,
          recipientFacilityId: row.recipient_facility_id || undefined,
          timestamp: row.created_at,
        }));
        setEvents(formatted);
      }
    } catch (err: any) {
      setError(err?.message || 'Error fetching events');
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !role) return;

    fetchRecentEvents();

    // 2. Scoped Realtime Channel backed by PostgreSQL Row Level Security (RLS)
    const channelName = `auth_role_events_${role.toLowerCase()}_${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'realtime_events',
        },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow) return;

          const eventItem: RealtimeHealthcareEvent = {
            id: newRow.id,
            type: newRow.type,
            actorId: newRow.actor_id,
            actorRole: newRow.actor_role as RealtimeRole,
            patientId: newRow.patient_id,
            relatedEntityId: newRow.related_entity_id,
            relatedEntityType: newRow.related_entity_type as RelatedEntityType,
            recipientType: newRow.recipient_type as RealtimeRole,
            recipientUserId: newRow.recipient_user_id || undefined,
            recipientFacilityId: newRow.recipient_facility_id || undefined,
            timestamp: newRow.created_at,
          };

          setEvents((prev) => [eventItem, ...prev.slice(0, 49)]);
          setLatestEvent(eventItem);

          if (onEventReceived) {
            onEventReceived(eventItem);
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn('Realtime subscription error:', err);
          setIsConnected(false);
          return;
        }
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn('Error removing realtime channel:', e);
      }
    };
  }, [role, userId, facilityId, onEventReceived, fetchRecentEvents]);

  return {
    events,
    latestEvent,
    isConnected,
    error,
    refreshEvents: fetchRecentEvents,
  };
}
