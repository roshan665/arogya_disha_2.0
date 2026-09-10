import { supabase } from '../supabaseClient';
import {
  RealtimeCommunicationService,
  RealtimeHealthcareEvent,
} from './RealtimeCommunicationService';

export type HospitalReferralStatus =
  | 'CREATED'
  | 'RECEIVED'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ADDITIONAL_INFORMATION_REQUIRED'
  | 'APPOINTMENT_SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'RETURNED_TO_PHC';

export interface CreatePhcReferralParams {
  patientId: string;
  sourceFacilityId: string; // Referring PHC
  destinationFacilityId: string; // Target District Hospital
  referringDoctorId: string;
  priority: 'RED' | 'YELLOW' | 'GREEN';
  reason: string;
  clinicalSummary: string;
  relevantReportIds?: string[];
}

export interface UpdateHospitalReferralStatusParams {
  referralId: string;
  patientId: string;
  sourceFacilityId: string; // Referring PHC
  destinationFacilityId: string; // District Hospital
  specialistId?: string;
  status: HospitalReferralStatus;
  rejectionReason?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  treatmentSummary?: string;
  followUpInstructions?: string;
  assignedAshaId?: string;
}

export interface RequestAdditionalInfoParams {
  referralId: string;
  patientId: string;
  sourceFacilityId: string; // Target PHC
  destinationFacilityId: string; // District Hospital
  specialistId: string;
  informationRequested: string;
}

export interface SubmitAdditionalInfoParams {
  referralId: string;
  patientId: string;
  sourceFacilityId: string; // Referring PHC
  destinationFacilityId: string; // Target District Hospital
  doctorId: string;
  informationProvided: string;
}

export class PhcDistrictHospitalCommunicationService {
  /**
   * 1. PHC CREATES REFERRAL -> DISTRICT HOSPITAL
   * Dispatches NEW_REFERRAL realtime event strictly to the designated District Hospital.
   */
  static async createPhcReferral(params: CreatePhcReferralParams): Promise<{
    referral: any;
    event: RealtimeHealthcareEvent;
  }> {
    if (
      !params.patientId ||
      !params.sourceFacilityId ||
      !params.destinationFacilityId ||
      !params.referringDoctorId ||
      !params.reason ||
      !params.clinicalSummary
    ) {
      throw new Error(
        'VALIDATION_ERROR: Missing required referral creation fields (patientId, sourceFacilityId, destinationFacilityId, referringDoctorId, reason, clinicalSummary).'
      );
    }

    const { data: referral, error } = await supabase
      .from('hospital_referrals')
      .insert({
        patient_id: params.patientId,
        source_facility_id: params.sourceFacilityId,
        destination_facility_id: params.destinationFacilityId,
        referring_doctor_id: params.referringDoctorId,
        priority: params.priority || 'YELLOW',
        reason: params.reason,
        clinical_summary: params.clinicalSummary,
        relevant_report_ids: params.relevantReportIds || [],
        status: 'CREATED',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create hospital referral in DB:', error);
      throw new Error(`REFERRAL_CREATION_FAILED: ${error.message}`);
    }

    // Realtime Event: PHC -> DISTRICT_HOSPITAL (NEW_REFERRAL)
    const event = await RealtimeCommunicationService.publishEvent({
      type: 'NEW_REFERRAL',
      actorId: params.referringDoctorId,
      actorRole: 'PHC',
      patientId: params.patientId,
      relatedEntityId: referral.id,
      relatedEntityType: 'referral',
      recipientType: 'DISTRICT_HOSPITAL',
      recipientFacilityId: params.destinationFacilityId,
    });

    return { referral, event };
  }

  /**
   * 2. DISTRICT HOSPITAL REFERRAL ACTIONS -> PHC
   * DH updates status (RECEIVED, UNDER_REVIEW, ACCEPTED, REJECTED, APPOINTMENT_SCHEDULED, IN_PROGRESS, COMPLETED, RETURNED_TO_PHC).
   * Notifies referring PHC in real time.
   * If APPOINTMENT_SCHEDULED: Fans out notification to Patient as well.
   * If COMPLETED / RETURNED_TO_PHC and follow-up needed: Dispatches FOLLOW_UP_REQUIRED to ASHA.
   */
  static async updateReferralStatus(params: UpdateHospitalReferralStatusParams): Promise<{
    updated: any;
    phcEvent: RealtimeHealthcareEvent;
    patientEvent?: RealtimeHealthcareEvent;
    ashaEvent?: RealtimeHealthcareEvent;
  }> {
    if (
      !params.referralId ||
      !params.patientId ||
      !params.sourceFacilityId ||
      !params.destinationFacilityId ||
      !params.status
    ) {
      throw new Error('VALIDATION_ERROR: Missing required parameters to update hospital referral status.');
    }

    const validStatuses: HospitalReferralStatus[] = [
      'CREATED',
      'RECEIVED',
      'UNDER_REVIEW',
      'ACCEPTED',
      'REJECTED',
      'ADDITIONAL_INFORMATION_REQUIRED',
      'APPOINTMENT_SCHEDULED',
      'IN_PROGRESS',
      'COMPLETED',
      'RETURNED_TO_PHC',
    ];

    if (!validStatuses.includes(params.status)) {
      throw new Error(`VALIDATION_ERROR: Invalid referral status "${params.status}".`);
    }

    const updatePayload: any = {
      status: params.status,
      updated_at: new Date().toISOString(),
    };

    if (params.specialistId) updatePayload.assigned_specialist_id = params.specialistId;
    if (params.rejectionReason) updatePayload.rejection_reason = params.rejectionReason;
    if (params.scheduledDate) updatePayload.scheduled_appointment_date = params.scheduledDate;
    if (params.scheduledTime) updatePayload.scheduled_appointment_time = params.scheduledTime;
    if (params.treatmentSummary) updatePayload.treatment_summary = params.treatmentSummary;
    if (params.followUpInstructions) updatePayload.follow_up_instructions = params.followUpInstructions;

    const { data: updated, error } = await supabase
      .from('hospital_referrals')
      .update(updatePayload)
      .eq('id', params.referralId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update hospital referral in DB:', error);
      throw new Error(`UPDATE_REFERRAL_FAILED: ${error.message}`);
    }

    // 1. Notify Referring PHC: DISTRICT_HOSPITAL -> PHC (e.g. REFERRAL_ACCEPTED, REFERRAL_COMPLETED, etc.)
    const phcEventType = `REFERRAL_${params.status}`;
    const phcEvent = await RealtimeCommunicationService.publishEvent({
      type: phcEventType,
      actorId: params.specialistId || params.destinationFacilityId,
      actorRole: 'DISTRICT_HOSPITAL',
      patientId: params.patientId,
      relatedEntityId: params.referralId,
      relatedEntityType: 'referral',
      recipientType: 'PHC',
      recipientFacilityId: params.sourceFacilityId,
    });

    let patientEvent: RealtimeHealthcareEvent | undefined;
    // 2. If APPOINTMENT_SCHEDULED, notify Patient in real-time
    if (params.status === 'APPOINTMENT_SCHEDULED') {
      patientEvent = await RealtimeCommunicationService.publishEvent({
        type: 'APPOINTMENT_SCHEDULED',
        actorId: params.specialistId || params.destinationFacilityId,
        actorRole: 'DISTRICT_HOSPITAL',
        patientId: params.patientId,
        relatedEntityId: params.referralId,
        relatedEntityType: 'referral',
        recipientType: 'PATIENT',
        recipientUserId: params.patientId,
      });
    }

    let ashaEvent: RealtimeHealthcareEvent | undefined;
    // 3. If COMPLETED / RETURNED_TO_PHC with follow-up required, notify ASHA in real-time
    if ((params.status === 'COMPLETED' || params.status === 'RETURNED_TO_PHC') && params.assignedAshaId) {
      ashaEvent = await RealtimeCommunicationService.publishEvent({
        type: 'FOLLOW_UP_REQUIRED',
        actorId: params.sourceFacilityId,
        actorRole: 'PHC',
        patientId: params.patientId,
        relatedEntityId: params.referralId,
        relatedEntityType: 'follow_up',
        recipientType: 'ASHA',
        recipientUserId: params.assignedAshaId,
      });
    }

    return { updated, phcEvent, patientEvent, ashaEvent };
  }

  /**
   * 3. ADDITIONAL INFORMATION REQUIRED: DISTRICT_HOSPITAL -> PHC
   */
  static async requestAdditionalInformation(params: RequestAdditionalInfoParams): Promise<{
    updated: any;
    event: RealtimeHealthcareEvent;
  }> {
    if (!params.referralId || !params.patientId || !params.sourceFacilityId || !params.informationRequested) {
      throw new Error('VALIDATION_ERROR: Missing required parameters for requesting additional information.');
    }

    const { data: updated, error } = await supabase
      .from('hospital_referrals')
      .update({
        status: 'ADDITIONAL_INFORMATION_REQUIRED',
        additional_info_requested: params.informationRequested,
        assigned_specialist_id: params.specialistId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.referralId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update referral in DB:', error);
      throw new Error(`REQUEST_ADDITIONAL_INFO_FAILED: ${error.message}`);
    }

    // Realtime event: DISTRICT_HOSPITAL -> PHC (ADDITIONAL_INFORMATION_REQUIRED)
    const event = await RealtimeCommunicationService.publishEvent({
      type: 'ADDITIONAL_INFORMATION_REQUIRED',
      actorId: params.specialistId,
      actorRole: 'DISTRICT_HOSPITAL',
      patientId: params.patientId,
      relatedEntityId: params.referralId,
      relatedEntityType: 'referral',
      recipientType: 'PHC',
      recipientFacilityId: params.sourceFacilityId,
    });

    return { updated, event };
  }

  /**
   * 4. ADDITIONAL INFORMATION SUBMITTED: PHC -> DISTRICT_HOSPITAL
   */
  static async submitAdditionalInformation(params: SubmitAdditionalInfoParams): Promise<{
    updated: any;
    event: RealtimeHealthcareEvent;
  }> {
    if (!params.referralId || !params.patientId || !params.destinationFacilityId || !params.informationProvided) {
      throw new Error('VALIDATION_ERROR: Missing required parameters for submitting additional information.');
    }

    const { data: updated, error } = await supabase
      .from('hospital_referrals')
      .update({
        status: 'UNDER_REVIEW',
        additional_info_provided: params.informationProvided,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.referralId)
      .select()
      .single();

    if (error) {
      console.error('Failed to submit additional info in DB:', error);
      throw new Error(`SUBMIT_ADDITIONAL_INFO_FAILED: ${error.message}`);
    }

    // Realtime event: PHC -> DISTRICT_HOSPITAL (ADDITIONAL_INFORMATION_SUBMITTED)
    const event = await RealtimeCommunicationService.publishEvent({
      type: 'ADDITIONAL_INFORMATION_SUBMITTED',
      actorId: params.doctorId,
      actorRole: 'PHC',
      patientId: params.patientId,
      relatedEntityId: params.referralId,
      relatedEntityType: 'referral',
      recipientType: 'DISTRICT_HOSPITAL',
      recipientFacilityId: params.destinationFacilityId,
    });

    return { updated, event };
  }
}
