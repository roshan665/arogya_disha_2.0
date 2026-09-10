import { supabase } from '../supabaseClient';

export type RealtimeRole = 'PATIENT' | 'ASHA' | 'PHC' | 'DISTRICT_HOSPITAL';

export type RelatedEntityType = 
  | 'referral' 
  | 'appointment' 
  | 'visit' 
  | 'diagnostic' 
  | 'follow_up' 
  | 'emergency' 
  | 'consultation' 
  | 'message';

export interface RealtimeHealthcareEvent {
  id: string;
  type: string;
  actorId: string;
  actorRole: RealtimeRole;
  patientId: string;
  relatedEntityId: string;
  relatedEntityType: RelatedEntityType;
  recipientType: RealtimeRole;
  recipientUserId?: string;
  recipientFacilityId?: string;
  timestamp: string;
}

export interface CreateRealtimeEventParams {
  type: string;
  actorId: string;
  actorRole: RealtimeRole;
  patientId: string;
  relatedEntityId: string;
  relatedEntityType: RelatedEntityType;
  recipientType: RealtimeRole;
  recipientUserId?: string;
  recipientFacilityId?: string;
}

export class RealtimeCommunicationService {
  /**
   * Sanitizes payload and verifies that NO sensitive medical records
   * (e.g. diagnoses, prescriptions, raw lab measurements) are leaked in the event.
   */
  static sanitizeEventPayload(params: CreateRealtimeEventParams): CreateRealtimeEventParams {
    const raw = params as any;
    // Security check: Block illegal medical record fields from event payloads
    const forbiddenFields = ['diagnosis', 'prescription', 'symptoms', 'vitals', 'medical_history', 'clinical_notes'];
    for (const field of forbiddenFields) {
      if (raw[field] !== undefined) {
        delete raw[field];
      }
    }

    if (!params.actorId || !params.actorRole || !params.patientId || !params.relatedEntityId || !params.recipientType) {
      throw new Error('VALIDATION_ERROR: Realtime event missing required routing fields (actorId, actorRole, patientId, relatedEntityId, recipientType).');
    }

    const validRoles: RealtimeRole[] = ['PATIENT', 'ASHA', 'PHC', 'DISTRICT_HOSPITAL'];
    if (!validRoles.includes(params.actorRole) || !validRoles.includes(params.recipientType)) {
      throw new Error(`VALIDATION_ERROR: Invalid role specified. Supported roles are strictly: ${validRoles.join(', ')}`);
    }

    return {
      type: params.type,
      actorId: params.actorId,
      actorRole: params.actorRole,
      patientId: params.patientId,
      relatedEntityId: params.relatedEntityId,
      relatedEntityType: params.relatedEntityType,
      recipientType: params.recipientType,
      recipientUserId: params.recipientUserId,
      recipientFacilityId: params.recipientFacilityId,
    };
  }

  /**
   * Publishes a single minimal, secure event to the PostgreSQL `realtime_events` table.
   * Supabase Realtime then securely broadcasts it strictly to authorized clients via PostgreSQL RLS.
   */
  static async publishEvent(params: CreateRealtimeEventParams): Promise<RealtimeHealthcareEvent> {
    const sanitized = this.sanitizeEventPayload(params);

    const { data, error } = await supabase
      .from('realtime_events')
      .insert({
        type: sanitized.type,
        actor_id: sanitized.actorId,
        actor_role: sanitized.actorRole,
        patient_id: sanitized.patientId,
        related_entity_id: sanitized.relatedEntityId,
        related_entity_type: sanitized.relatedEntityType,
        recipient_type: sanitized.recipientType,
        recipient_user_id: sanitized.recipientUserId || null,
        recipient_facility_id: sanitized.recipientFacilityId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to publish realtime event:', error);
      throw new Error(`REALTIME_PUBLISH_FAILED: ${error.message}`);
    }

    return {
      id: data.id,
      type: data.type,
      actorId: data.actor_id,
      actorRole: data.actor_role as RealtimeRole,
      patientId: data.patient_id,
      relatedEntityId: data.related_entity_id,
      relatedEntityType: data.related_entity_type as RelatedEntityType,
      recipientType: data.recipient_type as RealtimeRole,
      recipientUserId: data.recipient_user_id || undefined,
      recipientFacilityId: data.recipient_facility_id || undefined,
      timestamp: data.created_at,
    };
  }

  /**
   * Multi-role event fan-out: When a clinical workflow involves multiple stakeholders,
   * creates discrete, individually authorized minimal events for each recipient.
   */
  static async fanoutEvent(
    baseParams: Omit<CreateRealtimeEventParams, 'recipientType' | 'recipientUserId' | 'recipientFacilityId'>,
    recipients: Array<{
      recipientType: RealtimeRole;
      recipientUserId?: string;
      recipientFacilityId?: string;
    }>
  ): Promise<RealtimeHealthcareEvent[]> {
    const promises = recipients.map((r) =>
      this.publishEvent({
        ...baseParams,
        recipientType: r.recipientType,
        recipientUserId: r.recipientUserId,
        recipientFacilityId: r.recipientFacilityId,
      })
    );

    return Promise.all(promises);
  }
}

export interface ContextUser {
  userId: string;
  role: RealtimeRole;
  facilityId?: string;
  assignedPatientIds?: string[];
  activePatientCareIds?: string[];
}

export class RealtimeEventAuthorizer {
  /**
   * Evaluates if a given user context is authorized to receive a specific healthcare event.
   * Enforces the 5 Core Questions:
   * 1. WHO generated it?
   * 2. WHAT happened?
   * 3. WHICH patient is involved?
   * 4. WHO is allowed to receive it?
   * 5. WHY is the user allowed to receive it?
   */
  static isAuthorizedRecipient(event: RealtimeHealthcareEvent, user: ContextUser): boolean {
    if (!event || !user) return false;

    // 1. Direct 1-to-1 recipient match
    if (event.recipientUserId && event.recipientUserId === user.userId) {
      return true;
    }

    // 2. Role must match recipient type
    if (event.recipientType !== user.role) {
      return false;
    }

    // 3. PATIENT Scope: Can receive only about themselves
    if (user.role === 'PATIENT') {
      return event.patientId === user.userId || event.recipientUserId === user.userId;
    }

    // 4. ASHA Scope: Can receive only about assigned patients
    if (user.role === 'ASHA') {
      if (user.assignedPatientIds && user.assignedPatientIds.includes(event.patientId)) {
        return true;
      }
      return event.recipientUserId === user.userId;
    }

    // 5. PHC Scope: Can receive events related to facility care / referrals
    if (user.role === 'PHC') {
      if (event.recipientFacilityId && user.facilityId && event.recipientFacilityId === user.facilityId) {
        return true;
      }
      if (user.activePatientCareIds && user.activePatientCareIds.includes(event.patientId)) {
        return true;
      }
      return false;
    }

    // 6. DISTRICT_HOSPITAL Scope: Can receive events related to active hospital referrals/care
    if (user.role === 'DISTRICT_HOSPITAL') {
      if (event.recipientFacilityId && user.facilityId && event.recipientFacilityId === user.facilityId) {
        return true;
      }
      if (user.activePatientCareIds && user.activePatientCareIds.includes(event.patientId)) {
        return true;
      }
      return false;
    }

    return false;
  }
}
