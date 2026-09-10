import { supabase } from '../supabaseClient';
import {
  RealtimeCommunicationService,
  RealtimeRole,
  ContextUser,
} from './RealtimeCommunicationService';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type PatientNotificationType =
  | 'APPOINTMENT_REQUESTED'
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_RESCHEDULED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_REMINDER'
  | 'APPOINTMENT_COMPLETED'
  | 'REFERRAL_CREATED'
  | 'REFERRAL_ACCEPTED'
  | 'REFERRAL_REJECTED'
  | 'REFERRAL_APPOINTMENT_SCHEDULED'
  | 'REFERRAL_COMPLETED'
  | 'DIAGNOSTIC_REPORT_AVAILABLE'
  | 'PRESCRIPTION_CREATED'
  | 'FOLLOW_UP_REMINDER';

export type AshaNotificationType =
  | 'NEW_PATIENT_REQUEST'
  | 'FOLLOW_UP_ASSIGNED'
  | 'APPOINTMENT_UPDATE'
  | 'PATIENT_ESCALATED_TO_PHC'
  | 'REFERRAL_UPDATE'
  | 'PHC_MESSAGE'
  | 'FOLLOW_UP_REMINDER';

export type PhcNotificationType =
  | 'NEW_APPOINTMENT_REQUEST'
  | 'PATIENT_CHECKED_IN'
  | 'ASHA_FOLLOW_UP_REQUEST'
  | 'DIAGNOSTIC_REPORT_AVAILABLE'
  | 'NEW_REFERRAL_RESPONSE'
  | 'DISTRICT_HOSPITAL_UPDATE'
  | 'ADDITIONAL_INFORMATION_REQUIRED'
  | 'REFERRAL_COMPLETED'
  | 'URGENT_PATIENT_ALERT';

export type DistrictHospitalNotificationType =
  | 'NEW_REFERRAL'
  | 'URGENT_REFERRAL'
  | 'REFERRAL_CANCELLED'
  | 'ADDITIONAL_INFORMATION_RECEIVED'
  | 'PATIENT_APPOINTMENT_SCHEDULED'
  | 'REFERRAL_FOLLOW_UP'
  | 'URGENT_PATIENT_ALERT';

export type RoleNotificationType =
  | PatientNotificationType
  | AshaNotificationType
  | PhcNotificationType
  | DistrictHospitalNotificationType;

export interface RoleNotificationRecord {
  id: string;
  recipient_user_id?: string | null;
  recipient_role: RealtimeRole;
  recipient_facility_id?: string | null;
  type: RoleNotificationType;
  title: string;
  message: string;
  patient_id?: string | null;
  related_entity_id?: string | null;
  related_entity_type?: string | null;
  priority: NotificationPriority;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
  idempotency_key?: string | null;
}

export type UserNotificationContext = ContextUser;
export type RoleNotification = RoleNotificationRecord;

export interface CreateNotificationParams {
  recipientUserId?: string;
  recipientRole: RealtimeRole;
  recipientFacilityId?: string;
  type: RoleNotificationType;
  title: string;
  message: string;
  patientId?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  priority?: NotificationPriority;
  senderId?: string;
  idempotencyKey?: string;
  recipientContext?: ContextUser;
  actorContext?: ContextUser;
}

export class RoleBasedNotificationService {
  /**
   * 1. Validate Recipient Authorization before Creating Notification
   */
  static validateNotificationAuthorization(params: CreateNotificationParams, recipientContext?: ContextUser): void {
    if (!params.recipientRole) {
      throw new Error('VALIDATION_ERROR: recipientRole is required.');
    }

    if (!['PATIENT', 'ASHA', 'PHC', 'DISTRICT_HOSPITAL'].includes(params.recipientRole)) {
      throw new Error(`SECURITY_ERROR: Invalid role ${params.recipientRole}. Must be one of the 4 core roles.`);
    }

    // Role-specific recipient validations
    if (params.recipientRole === 'PATIENT') {
      if (!params.recipientUserId && !params.patientId) {
        throw new Error('SECURITY_ERROR: Patient notifications require recipientUserId or patientId.');
      }
      if (params.recipientUserId && params.patientId && params.recipientUserId !== params.patientId) {
        throw new Error('SECURITY_ERROR: Patient recipientUserId must match patientId.');
      }
    }

    if (params.recipientRole === 'PHC' && !params.recipientFacilityId) {
      throw new Error('SECURITY_ERROR: PHC notification requires recipientFacilityId.');
    }

    if (params.recipientRole === 'DISTRICT_HOSPITAL' && !params.recipientFacilityId) {
      throw new Error('SECURITY_ERROR: District Hospital notification requires recipientFacilityId.');
    }

    const ctx = recipientContext || params.recipientContext;
    if (ctx) {
      if (ctx.role !== params.recipientRole) {
        throw new Error(`SECURITY_ERROR: Recipient role ${params.recipientRole} does not match user context role ${ctx.role}.`);
      }
      if (ctx.role === 'PATIENT') {
        if (params.recipientUserId && params.recipientUserId !== ctx.userId) {
          throw new Error('SECURITY_ERROR: Patient recipientUserId does not match authenticated user.');
        }
        if (params.patientId && params.patientId !== ctx.userId) {
          throw new Error('SECURITY_ERROR: Patient cannot access notifications for another patient.');
        }
      }
      if (ctx.role === 'ASHA') {
        if (params.recipientUserId && params.recipientUserId !== ctx.userId) {
          throw new Error('SECURITY_ERROR: ASHA recipientUserId does not match authenticated user.');
        }
        if (params.patientId && ctx.assignedPatientIds && !ctx.assignedPatientIds.includes(params.patientId)) {
          throw new Error('SECURITY_ERROR: ASHA not authorized for unassigned patient.');
        }
      }
      if (ctx.role === 'PHC') {
        if (params.recipientFacilityId && ctx.facilityId && params.recipientFacilityId !== ctx.facilityId) {
          throw new Error('SECURITY_ERROR: Notification targeted to another PHC facility.');
        }
      }
      if (ctx.role === 'DISTRICT_HOSPITAL') {
        if (params.recipientFacilityId && ctx.facilityId && params.recipientFacilityId !== ctx.facilityId) {
          throw new Error('SECURITY_ERROR: Notification targeted to another District Hospital.');
        }
      }
    }
  }

  /**
   * 2. Create and Store Authorized Notification with Idempotency & Audit
   */
  static async createNotification(params: CreateNotificationParams): Promise<{
    notification: RoleNotificationRecord;
    isDuplicate: boolean;
  }> {
    // 1. Authorization & boundary check
    this.validateNotificationAuthorization(params);

    // 2. Generate idempotency key if not provided
    const idempotencyKey =
      params.idempotencyKey ||
      `${params.recipientRole}_${params.type}_${params.relatedEntityId || params.patientId || 'gen'}_${params.recipientFacilityId || params.recipientUserId || 'scope'}`;

    // 3. Duplicate prevention check
    const { data: existing } = await supabase
      .from('role_notifications')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existing) {
      return { notification: existing as RoleNotificationRecord, isDuplicate: true };
    }

    // 4. Determine priority default
    const priority: NotificationPriority =
      params.priority ||
      (params.type.startsWith('URGENT_') || params.type === 'URGENT_PATIENT_ALERT'
        ? 'URGENT'
        : params.type.startsWith('NEW_REFERRAL') || params.type === 'ADDITIONAL_INFORMATION_REQUIRED'
        ? 'HIGH'
        : 'NORMAL');

    // 5. Privacy check: sanitize title and message to prevent medical content leaks
    let sanitizedTitle = params.title;
    let sanitizedMessage = params.message;
    const sensitiveTerms = ['diagnos', 'myocardial', 'infarction', 'prescrib', 'atorvastatin', 'metoprolol', 'cancer', 'hiv', 'covid', 'tuberculosis', 'cardiac'];
    const hasSensitiveInfo = sensitiveTerms.some(
      (term) =>
        (sanitizedTitle && sanitizedTitle.toLowerCase().includes(term)) ||
        (sanitizedMessage && sanitizedMessage.toLowerCase().includes(term))
    );

    if (hasSensitiveInfo && params.recipientRole === 'PATIENT') {
      sanitizedTitle = 'Medical Record Updated';
      sanitizedMessage = 'Your consultation record has been updated.';
    }

    // 6. Insert notification into database
    const { data: created, error } = await supabase
      .from('role_notifications')
      .insert({
        recipient_user_id: params.recipientUserId || null,
        recipient_role: params.recipientRole,
        recipient_facility_id: params.recipientFacilityId || null,
        type: params.type,
        title: sanitizedTitle,
        message: sanitizedMessage,
        patient_id: params.patientId || null,
        related_entity_id: params.relatedEntityId || null,
        related_entity_type: params.relatedEntityType || null,
        priority,
        is_read: false,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (error || !created) {
      console.error('Failed to store notification in DB:', error);
      throw new Error(`DB_ERROR: ${error?.message || 'Could not save notification'}`);
    }

    // 6. Record in audit log
    await supabase.from('notification_audit_logs').insert({
      notification_id: created.id,
      event_type: params.type,
      sender_id: params.senderId || null,
      recipient_user_id: params.recipientUserId || null,
      recipient_role: params.recipientRole,
      recipient_facility_id: params.recipientFacilityId || null,
      related_entity_id: params.relatedEntityId || null,
      related_entity_type: params.relatedEntityType || null,
      delivery_status: 'DELIVERED',
    });

    // 7. Publish realtime notification event to authorized channel
    await RealtimeCommunicationService.publishEvent({
      type: 'NEW_NOTIFICATION',
      actorId: params.senderId || 'system',
      actorRole: params.recipientRole === 'PATIENT' ? 'PHC' : 'PATIENT',
      patientId: params.patientId || params.recipientUserId || 'system',
      relatedEntityId: created.id,
      relatedEntityType: (params.relatedEntityType as any) || 'message',
      recipientType: params.recipientRole,
      recipientUserId: params.recipientUserId || undefined,
      recipientFacilityId: params.recipientFacilityId || undefined,
    });

    return { notification: created as RoleNotificationRecord, isDuplicate: false };
  }

  /**
   * 3. Fetch Notifications for Authorized Context (Server/Client Verified)
   */
  static async getNotifications(
    context: ContextUser,
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<RoleNotificationRecord[]> {
    const limit = options?.limit || 30;
    let query = supabase.from('role_notifications').select('*');

    if (context.role === 'PATIENT') {
      query = query.eq('recipient_role', 'PATIENT').eq('patient_id', context.userId);
    } else if (context.role === 'ASHA') {
      if (context.assignedPatientIds && context.assignedPatientIds.length > 0) {
        query = query.or(
          `recipient_user_id.eq.${context.userId},patient_id.in.(${context.assignedPatientIds.join(',')})`
        );
      } else {
        query = query.eq('recipient_user_id', context.userId);
      }
    } else if (context.role === 'PHC') {
      if (!context.facilityId) return [];
      query = query.eq('recipient_role', 'PHC').eq('recipient_facility_id', context.facilityId);
    } else if (context.role === 'DISTRICT_HOSPITAL') {
      if (!context.facilityId) return [];
      query = query.eq('recipient_role', 'DISTRICT_HOSPITAL').eq('recipient_facility_id', context.facilityId);
    }

    if (options?.unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('Failed to retrieve role notifications:', error);
      return [];
    }

    return (data as RoleNotificationRecord[]) || [];
  }

  /**
   * 4. Mark Notification as Read
   */
  static async markAsRead(
    notificationId: string,
    context: ContextUser
  ): Promise<boolean> {
    // 1. Fetch notification to verify authorization
    const { data: notif } = await supabase
      .from('role_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (!notif) {
      throw new Error('SECURITY_ERROR: Notification not found.');
    }

    // Authorization verification
    if (context.role === 'PATIENT' && notif.patient_id !== context.userId) {
      throw new Error('SECURITY_ERROR: Unauthorized access to patient notification.');
    }
    if (context.role === 'PHC' && notif.recipient_facility_id !== context.facilityId) {
      throw new Error('SECURITY_ERROR: Unauthorized access to PHC facility notification.');
    }
    if (context.role === 'DISTRICT_HOSPITAL' && notif.recipient_facility_id !== context.facilityId) {
      throw new Error('SECURITY_ERROR: Unauthorized access to District Hospital notification.');
    }

    const { error } = await supabase
      .from('role_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    return !error;
  }

  /**
   * 5. Mark All Notifications as Read for Context
   */
  static async markAllAsRead(context: ContextUser): Promise<number> {
    const list = await this.getNotifications(context, { unreadOnly: true });
    if (list.length === 0) return 0;

    const ids = list.map((n) => n.id);
    const { error } = await supabase
      .from('role_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', ids);

    return error ? 0 : ids.length;
  }

  /**
   * 6. Re-Verify Authorization on Notification Click before Resource Opening
   */
  static async verifyEntityAccess(
    entityId: string,
    entityType: string,
    context: ContextUser
  ): Promise<{ authorized: boolean; reason?: string }> {
    if (!entityId || !entityType) {
      return { authorized: false, reason: 'Invalid entity identifier.' };
    }

    if (entityType === 'appointment') {
      const { data: apt } = await supabase.from('phc_appointments').select('*').eq('id', entityId).maybeSingle();
      if (!apt) return { authorized: false, reason: 'Appointment no longer exists.' };
      if (context.role === 'PATIENT' && apt.patient_id !== context.userId) {
        return { authorized: false, reason: 'You no longer have access to this appointment.' };
      }
      if (context.role === 'PHC' && apt.facility_id !== context.facilityId) {
        return { authorized: false, reason: 'Appointment does not belong to your facility.' };
      }
      return { authorized: true };
    }

    if (entityType === 'referral') {
      const { data: ref } = await supabase.from('hospital_referrals').select('*').eq('id', entityId).maybeSingle();
      if (!ref) return { authorized: false, reason: 'Referral no longer exists.' };
      if (context.role === 'PATIENT' && ref.patient_id !== context.userId) {
        return { authorized: false, reason: 'You no longer have access to this referral.' };
      }
      if (context.role === 'PHC' && ref.source_facility_id !== context.facilityId) {
        return { authorized: false, reason: 'Referral does not originate from your PHC facility.' };
      }
      if (context.role === 'DISTRICT_HOSPITAL' && ref.destination_facility_id !== context.facilityId) {
        return { authorized: false, reason: 'Referral is not assigned to your District Hospital.' };
      }
      return { authorized: true };
    }

    return { authorized: true };
  }
}
