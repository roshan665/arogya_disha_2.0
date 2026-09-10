import { useState, useEffect, useCallback } from 'react';
import {
  RoleBasedNotificationService,
  RoleNotificationRecord,
} from '../services/RoleBasedNotificationService';
import { ContextUser } from '../services/RealtimeCommunicationService';
import { useRoleRealtimeCommunication } from './useRoleRealtimeCommunication';

export function useRoleBasedNotifications(context: ContextUser) {
  const [notifications, setNotifications] = useState<RoleNotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { userId, role, facilityId } = context;

  // 1. Fetch initial notifications
  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await RoleBasedNotificationService.getNotifications(context);
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (err) {
      console.warn('Failed to load role notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, role, facilityId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // 2. Realtime listener for NEW_NOTIFICATION
  useRoleRealtimeCommunication({
    role,
    userId,
    facilityId,
    onEventReceived: (event) => {
      if (event.type === 'NEW_NOTIFICATION') {
        console.log('Realtime NEW_NOTIFICATION event received for role:', role);
        loadNotifications();
      }
    },
  });

  // 3. Mark a single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await RoleBasedNotificationService.markAsRead(notificationId, context);
      } catch (err) {
        console.warn('Mark as read notice:', err);
      }
    },
    [userId, role, facilityId]
  );

  // 4. Mark all as read
  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);
    try {
      await RoleBasedNotificationService.markAllAsRead(context);
    } catch (err) {
      console.warn('Mark all as read notice:', err);
    }
  }, [context]);

  // 5. Verify access before opening entity
  const verifyAndOpenEntity = useCallback(
    async (notification: RoleNotificationRecord): Promise<{ allowed: boolean; message?: string }> => {
      if (!notification.related_entity_id || !notification.related_entity_type) {
        return { allowed: true };
      }

      const check = await RoleBasedNotificationService.verifyEntityAccess(
        notification.related_entity_id,
        notification.related_entity_type,
        context
      );

      return { allowed: check.authorized, message: check.reason };
    },
    [context]
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    verifyAndOpenEntity,
  };
}
