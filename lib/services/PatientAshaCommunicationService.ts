import { supabase } from '../supabaseClient';
import { RealtimeCommunicationService } from './RealtimeCommunicationService';

export type AssistanceRequestStatus = 
  | 'PENDING' 
  | 'ACCEPTED' 
  | 'CONTACTED' 
  | 'VISIT_SCHEDULED' 
  | 'FOLLOW_UP_REQUIRED' 
  | 'COMPLETED';

export type FollowUpType = 
  | 'patient_contacted' 
  | 'home_visit_completed' 
  | 'patient_missed_appointment' 
  | 'patient_needs_phc_consultation' 
  | 'follow_up_required';

export interface RequestAssistanceParams {
  patientId: string;
  ashaId: string;
  requestType: string;
  message: string;
}

export interface UpdateRequestStatusParams {
  requestId: string;
  patientId: string;
  ashaId: string;
  status: AssistanceRequestStatus;
}

export interface CreateAshaFollowUpParams {
  patientId: string;
  ashaId: string;
  followUpType: FollowUpType;
  publicPatientUpdate: string;
  internalAshaNotes?: string;
  escalateToPhc?: boolean;
  phcFacilityId?: string;
  scheduledDate?: string;
}

export class PatientAshaCommunicationService {
  /**
   * 1. PATIENT -> ASHA: Request Assistance
   * Stores the request in patient_assistance_requests and dispatches NEW_PATIENT_REQUEST to the assigned ASHA.
   */
  static async requestAshaAssistance(params: RequestAssistanceParams) {
    if (!params.patientId || !params.ashaId || !params.message) {
      throw new Error('VALIDATION_ERROR: patientId, ashaId, and message are required.');
    }

    const { data: request, error } = await supabase
      .from('patient_assistance_requests')
      .insert({
        patient_id: params.patientId,
        asha_id: params.ashaId,
        request_type: params.requestType || 'GENERAL_ASSISTANCE',
        message: params.message,
        status: 'PENDING',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create assistance request:', error);
      throw new Error(`DB_ERROR: ${error.message}`);
    }

    // Dispatch minimal realtime event to ASSIGNED ASHA
    const realtimeEvent = await RealtimeCommunicationService.publishEvent({
      type: 'NEW_PATIENT_REQUEST',
      actorId: params.patientId,
      actorRole: 'PATIENT',
      patientId: params.patientId,
      relatedEntityId: request.id,
      relatedEntityType: 'message',
      recipientType: 'ASHA',
      recipientUserId: params.ashaId,
    });

    return { request, realtimeEvent };
  }

  /**
   * 2. ASHA -> PATIENT: Update Request Status
   * Updates the assistance request and notifies the patient in real time (status only, no medical data).
   */
  static async updateAssistanceRequestStatus(params: UpdateRequestStatusParams) {
    const validStatuses: AssistanceRequestStatus[] = [
      'PENDING',
      'ACCEPTED',
      'CONTACTED',
      'VISIT_SCHEDULED',
      'FOLLOW_UP_REQUIRED',
      'COMPLETED',
    ];

    if (!validStatuses.includes(params.status)) {
      throw new Error(`INVALID_STATUS: Allowed statuses are ${validStatuses.join(', ')}`);
    }

    const { data: updated, error } = await supabase
      .from('patient_assistance_requests')
      .update({
        status: params.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.requestId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update assistance request:', error);
      throw new Error(`DB_ERROR: ${error.message}`);
    }

    // Dispatch minimal realtime event to PATIENT
    const realtimeEvent = await RealtimeCommunicationService.publishEvent({
      type: `REQUEST_${params.status}`,
      actorId: params.ashaId,
      actorRole: 'ASHA',
      patientId: params.patientId,
      relatedEntityId: params.requestId,
      relatedEntityType: 'message',
      recipientType: 'PATIENT',
      recipientUserId: params.patientId,
    });

    return { updated, realtimeEvent };
  }

  /**
   * 3. ASHA -> PATIENT & PHC: Record Follow-Up & Handle Escalations
   * Internal ASHA notes are strictly stored in DB and NEVER leaked in the patient realtime event.
   * If escalated, sends a PHC_FOLLOWUP_REQUEST event to the supervising PHC.
   */
  static async recordAshaFollowUp(params: CreateAshaFollowUpParams) {
    if (!params.patientId || !params.ashaId || !params.publicPatientUpdate) {
      throw new Error('VALIDATION_ERROR: patientId, ashaId, and publicPatientUpdate are required.');
    }

    const isEscalated =
      params.escalateToPhc === true ||
      params.followUpType === 'patient_needs_phc_consultation';

    const { data: followUp, error } = await supabase
      .from('asha_follow_up_records')
      .insert({
        patient_id: params.patientId,
        asha_id: params.ashaId,
        follow_up_type: params.followUpType,
        public_patient_update: params.publicPatientUpdate,
        internal_asha_notes: params.internalAshaNotes || null, // Confidential, not sent in event
        escalate_to_phc: isEscalated,
        phc_facility_id: params.phcFacilityId || null,
        scheduled_date: params.scheduledDate || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create follow-up record:', error);
      throw new Error(`DB_ERROR: ${error.message}`);
    }

    // 1. Notify PATIENT with safe update only (zero internal notes)
    const patientEvent = await RealtimeCommunicationService.publishEvent({
      type: 'ASHA_FOLLOWUP_RECORDED',
      actorId: params.ashaId,
      actorRole: 'ASHA',
      patientId: params.patientId,
      relatedEntityId: followUp.id,
      relatedEntityType: 'follow_up',
      recipientType: 'PATIENT',
      recipientUserId: params.patientId,
    });

    let phcEvent = null;
    // 2. If escalated, dispatch PHC_FOLLOWUP_REQUEST to supervising PHC
    if (isEscalated && params.phcFacilityId) {
      phcEvent = await RealtimeCommunicationService.publishEvent({
        type: 'PHC_FOLLOWUP_REQUEST',
        actorId: params.ashaId,
        actorRole: 'ASHA',
        patientId: params.patientId,
        relatedEntityId: followUp.id,
        relatedEntityType: 'follow_up',
        recipientType: 'PHC',
        recipientFacilityId: params.phcFacilityId,
      });
    }

    return { followUp, patientEvent, phcEvent };
  }
}
