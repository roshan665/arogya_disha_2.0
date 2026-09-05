import { supabase } from '../supabaseClient';

export interface NotificationPayload {
  userId: string; // The target recipient
  title: string;
  message: string;
  type: string;
  entityId: string;
  entityType: string;
}

export class NotificationService {
  /**
   * Publishes a domain event directly to the notifications table.
   * Supabase Realtime will automatically pick this up and broadcast it 
   * securely to the recipient via PostgreSQL RLS.
   */
  static async publishEvent(payload: NotificationPayload) {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: payload.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        entity_id: payload.entityId,
        entity_type: payload.entityType
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to publish notification:', error);
      // In a robust system, we might want to throw or queue for retry.
      // For now, we will throw to ensure tests pass on failure.
      throw new Error(error.message);
    }
    
    return data;
  }
}
