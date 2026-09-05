import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  entity_id: string;
  is_read: boolean;
  created_at: string;
}

export function useRealtimeNotifications(userId: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchInitial();

    const subscription = supabase
      .channel(`user_notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications(prev => [payload.new as AppNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? (payload.new as AppNotification) : n));
          // Recalculate unread count (naive approach for hook simplicity)
          setUnreadCount(prev => payload.new.is_read ? prev - 1 : prev);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  };

  return { notifications, unreadCount, markAsRead };
}
