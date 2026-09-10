import { supabase } from '../supabaseClient';
import {
  RealtimeCommunicationService,
  RealtimeHealthcareEvent,
} from './RealtimeCommunicationService';
import { PatientAshaCommunicationService } from './PatientAshaCommunicationService';
import { PatientPhcCommunicationService } from './PatientPhcCommunicationService';
import { PhcDistrictHospitalCommunicationService } from './PhcDistrictHospitalCommunicationService';

export type AshaEvaluationOutcome =
  | 'NO_FURTHER_ACTION'
  | 'FOLLOW_UP_REQUIRED'
  | 'PHC_ATTENTION_REQUIRED';

export type PhcEvaluationOutcome =
  | 'TREATMENT_AT_PHC'
  | 'FOLLOW_UP'
  | 'REFER_TO_DISTRICT_HOSPITAL';

export type DhProcessOutcome =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ADDITIONAL_INFORMATION_REQUIRED'
  | 'TREATMENT_STARTED'
  | 'COMPLETED';

export class HealthcareJourneyLoopService {
  /**
   * STEP 1 — PATIENT
   * Patient requests assistance or appointment.
   * Dispatches authorized event to assigned ASHA and/or PHC.
   */
  static async step1_patientInitiate(params: {
    patientId: string;
    ashaId?: string;
    phcFacilityId?: string;
    requestType: string;
    message: string;
  }): Promise<{
    ashaEvent?: RealtimeHealthcareEvent;
    phcEvent?: RealtimeHealthcareEvent;
  }> {
    let ashaEvent: RealtimeHealthcareEvent | undefined;
    let phcEvent: RealtimeHealthcareEvent | undefined;

    if (params.ashaId) {
      const res = await PatientAshaCommunicationService.requestAshaAssistance({
        patientId: params.patientId,
        ashaId: params.ashaId,
        requestType: params.requestType,
        message: params.message,
      });
      ashaEvent = res.event;
    }

    if (params.phcFacilityId) {
      const res = await PatientPhcCommunicationService.requestPhcAppointment({
        patientId: params.patientId,
        phcFacilityId: params.phcFacilityId,
        consultType: params.requestType,
        preferredDate: new Date().toISOString().split('T')[0],
        preferredTimeSlot: '10:00 AM',
        notes: params.message,
      });
      phcEvent = res.event;
    }

    return { ashaEvent, phcEvent };
  }

  /**
   * STEP 2 — ASHA
   * ASHA performs community-level follow-up.
   * Outcomes: NO_FURTHER_ACTION | FOLLOW_UP_REQUIRED | PHC_ATTENTION_REQUIRED.
   * If PHC attention required: Dispatches event to PHC.
   */
  static async step2_ashaEvaluate(params: {
    patientId: string;
    ashaId: string;
    phcFacilityId: string;
    outcome: AshaEvaluationOutcome;
    notes?: string;
    publicPatientUpdate: string;
    internalAshaNotes?: string;
  }): Promise<{
    patientEvent: RealtimeHealthcareEvent;
    phcEvent?: RealtimeHealthcareEvent;
  }> {
    const escalateToPhc = params.outcome === 'PHC_ATTENTION_REQUIRED';

    const result = await PatientAshaCommunicationService.recordAshaFollowUp({
      patientId: params.patientId,
      ashaId: params.ashaId,
      followUpType:
        params.outcome === 'PHC_ATTENTION_REQUIRED'
          ? 'patient_needs_phc_consultation'
          : params.outcome === 'FOLLOW_UP_REQUIRED'
          ? 'follow_up_required'
          : 'home_visit_completed',
      publicPatientUpdate: params.publicPatientUpdate,
      internalAshaNotes: params.internalAshaNotes,
      escalateToPhc,
      phcFacilityId: params.phcFacilityId,
    });

    return {
      patientEvent: result.patientEvent,
      phcEvent: result.phcEvent || undefined,
    };
  }

  /**
   * STEP 3 — PHC
   * PHC evaluates the patient.
   * Outcomes: TREATMENT_AT_PHC | FOLLOW_UP | REFER_TO_DISTRICT_HOSPITAL.
   * If referral is required: PHC -> DISTRICT_HOSPITAL.
   */
  static async step3_phcEvaluate(params: {
    patientId: string;
    doctorId: string;
    phcFacilityId: string;
    destinationDhFacilityId?: string;
    outcome: PhcEvaluationOutcome;
    reason?: string;
    clinicalSummary: string;
    priority?: 'RED' | 'YELLOW' | 'GREEN';
    publicPatientSummary: string;
    internalDoctorNotes?: string;
  }): Promise<{
    phcConsultationEvent?: RealtimeHealthcareEvent;
    dhReferralEvent?: RealtimeHealthcareEvent;
    patientNotificationEvent?: RealtimeHealthcareEvent;
  }> {
    let phcConsultationEvent: RealtimeHealthcareEvent | undefined;
    let dhReferralEvent: RealtimeHealthcareEvent | undefined;
    let patientNotificationEvent: RealtimeHealthcareEvent | undefined;

    if (params.outcome === 'TREATMENT_AT_PHC' || params.outcome === 'FOLLOW_UP') {
      const consult = await PatientPhcCommunicationService.completeConsultation({
        patientId: params.patientId,
        phcFacilityId: params.phcFacilityId,
        doctorId: params.doctorId,
        publicSummary: params.publicPatientSummary,
        internalClinicalNotes: params.internalDoctorNotes,
      });
      phcConsultationEvent = consult.event;
    } else if (params.outcome === 'REFER_TO_DISTRICT_HOSPITAL') {
      if (!params.destinationDhFacilityId) {
        throw new Error('VALIDATION_ERROR: Missing destination District Hospital facility ID for referral.');
      }

      const ref = await PhcDistrictHospitalCommunicationService.createPhcReferral({
        patientId: params.patientId,
        sourceFacilityId: params.phcFacilityId,
        destinationFacilityId: params.destinationDhFacilityId,
        referringDoctorId: params.doctorId,
        priority: params.priority || 'RED',
        reason: params.reason || 'Specialist Evaluation Required',
        clinicalSummary: params.clinicalSummary,
      });
      dhReferralEvent = ref.event;

      // Patient facing update
      patientNotificationEvent = await RealtimeCommunicationService.publishEvent({
        type: 'PATIENT_REFERRED_TO_HOSPITAL',
        actorId: params.doctorId,
        actorRole: 'PHC',
        patientId: params.patientId,
        relatedEntityId: ref.referral.id,
        relatedEntityType: 'referral',
        recipientType: 'PATIENT',
        recipientUserId: params.patientId,
      });
    }

    return { phcConsultationEvent, dhReferralEvent, patientNotificationEvent };
  }

  /**
   * STEP 4 — DISTRICT HOSPITAL
   * District Hospital reviews referral.
   * Outcomes: ACCEPTED | REJECTED | ADDITIONAL_INFORMATION_REQUIRED | TREATMENT_STARTED | COMPLETED.
   */
  static async step4_districtHospitalProcess(params: {
    referralId: string;
    patientId: string;
    dhFacilityId: string;
    phcFacilityId: string;
    specialistId: string;
    outcome: DhProcessOutcome;
    rejectionReason?: string;
    informationRequested?: string;
    scheduledDate?: string;
    scheduledTime?: string;
  }): Promise<{
    phcEvent: RealtimeHealthcareEvent;
    patientEvent?: RealtimeHealthcareEvent;
  }> {
    if (params.outcome === 'ADDITIONAL_INFORMATION_REQUIRED') {
      const res = await PhcDistrictHospitalCommunicationService.requestAdditionalInformation({
        referralId: params.referralId,
        patientId: params.patientId,
        sourceFacilityId: params.phcFacilityId,
        destinationFacilityId: params.dhFacilityId,
        specialistId: params.specialistId,
        informationRequested: params.informationRequested || 'Additional diagnostic strip required.',
      });
      return { phcEvent: res.event };
    }

    const res = await PhcDistrictHospitalCommunicationService.updateReferralStatus({
      referralId: params.referralId,
      patientId: params.patientId,
      sourceFacilityId: params.phcFacilityId,
      destinationFacilityId: params.dhFacilityId,
      specialistId: params.specialistId,
      status:
        params.outcome === 'ACCEPTED'
          ? 'ACCEPTED'
          : params.outcome === 'REJECTED'
          ? 'REJECTED'
          : params.outcome === 'TREATMENT_STARTED'
          ? 'IN_PROGRESS'
          : 'COMPLETED',
      rejectionReason: params.rejectionReason,
      scheduledDate: params.scheduledDate,
      scheduledTime: params.scheduledTime,
    });

    let patientEvent = res.patientEvent;
    if (params.outcome === 'ACCEPTED') {
      patientEvent = await RealtimeCommunicationService.publishEvent({
        type: 'REFERRAL_ACCEPTED',
        actorId: params.specialistId,
        actorRole: 'DISTRICT_HOSPITAL',
        patientId: params.patientId,
        relatedEntityId: params.referralId,
        relatedEntityType: 'referral',
        recipientType: 'PATIENT',
        recipientUserId: params.patientId,
      });
    }

    return { phcEvent: res.phcEvent, patientEvent };
  }

  /**
   * STEP 5 — RETURN TO PHC
   * When District Hospital completes the referral:
   * DISTRICT_HOSPITAL -> PHC
   * Sends referral outcome notification to PHC and patient.
   */
  static async step5_districtHospitalReturnToPhc(params: {
    referralId: string;
    patientId: string;
    dhFacilityId: string;
    phcFacilityId: string;
    specialistId: string;
    treatmentSummary: string;
    followUpInstructions: string;
  }): Promise<{
    phcOutcomeEvent: RealtimeHealthcareEvent;
    patientOutcomeEvent: RealtimeHealthcareEvent;
  }> {
    const res = await PhcDistrictHospitalCommunicationService.updateReferralStatus({
      referralId: params.referralId,
      patientId: params.patientId,
      sourceFacilityId: params.phcFacilityId,
      destinationFacilityId: params.dhFacilityId,
      specialistId: params.specialistId,
      status: 'RETURNED_TO_PHC',
      treatmentSummary: params.treatmentSummary,
      followUpInstructions: params.followUpInstructions,
    });

    const patientOutcomeEvent = await RealtimeCommunicationService.publishEvent({
      type: 'HOSPITAL_TREATMENT_COMPLETED',
      actorId: params.specialistId,
      actorRole: 'DISTRICT_HOSPITAL',
      patientId: params.patientId,
      relatedEntityId: params.referralId,
      relatedEntityType: 'referral',
      recipientType: 'PATIENT',
      recipientUserId: params.patientId,
    });

    return {
      phcOutcomeEvent: res.phcEvent,
      patientOutcomeEvent,
    };
  }

  /**
   * STEP 6 — ASHA FOLLOW-UP
   * PHC decides ASHA community follow-up is required:
   * PHC -> ASHA (FOLLOW_UP_REQUIRED / COMMUNITY_FOLLOW_UP_ASSIGNED)
   * Patient receives notification that follow-up is due.
   */
  static async step6_phcAssignAshaFollowUp(params: {
    patientId: string;
    phcFacilityId: string;
    ashaId: string;
    instructions: string;
    dueDate?: string;
  }): Promise<{
    ashaTaskEvent: RealtimeHealthcareEvent;
    patientFollowUpDueEvent: RealtimeHealthcareEvent;
  }> {
    const ashaTaskEvent = await RealtimeCommunicationService.publishEvent({
      type: 'COMMUNITY_FOLLOW_UP_ASSIGNED',
      actorId: params.phcFacilityId,
      actorRole: 'PHC',
      patientId: params.patientId,
      relatedEntityId: 'task-fu-' + Date.now(),
      relatedEntityType: 'follow_up',
      recipientType: 'ASHA',
      recipientUserId: params.ashaId,
    });

    const patientFollowUpDueEvent = await RealtimeCommunicationService.publishEvent({
      type: 'FOLLOW_UP_DUE',
      actorId: params.phcFacilityId,
      actorRole: 'PHC',
      patientId: params.patientId,
      relatedEntityId: 'task-fu-' + Date.now(),
      relatedEntityType: 'follow_up',
      recipientType: 'PATIENT',
      recipientUserId: params.patientId,
    });

    return { ashaTaskEvent, patientFollowUpDueEvent };
  }

  /**
   * STEP 7 — PATIENT
   * ASHA completes the community follow-up task.
   * Patient receives confirmation of visit/follow-up completion.
   * Internal notes are strictly shielded.
   */
  static async step7_ashaCompleteFollowUpTask(params: {
    taskId: string;
    patientId: string;
    ashaId: string;
    phcFacilityId: string;
    publicPatientUpdate: string;
    internalAshaNotes?: string;
  }): Promise<{
    patientCompletionEvent: RealtimeHealthcareEvent;
    phcCompletionEvent: RealtimeHealthcareEvent;
  }> {
    const patientCompletionEvent = await RealtimeCommunicationService.publishEvent({
      type: 'HOME_VISIT_COMPLETED',
      actorId: params.ashaId,
      actorRole: 'ASHA',
      patientId: params.patientId,
      relatedEntityId: params.taskId,
      relatedEntityType: 'follow_up',
      recipientType: 'PATIENT',
      recipientUserId: params.patientId,
    });

    const phcCompletionEvent = await RealtimeCommunicationService.publishEvent({
      type: 'ASHA_FOLLOWUP_COMPLETED',
      actorId: params.ashaId,
      actorRole: 'ASHA',
      patientId: params.patientId,
      relatedEntityId: params.taskId,
      relatedEntityType: 'follow_up',
      recipientType: 'PHC',
      recipientFacilityId: params.phcFacilityId,
    });

    return { patientCompletionEvent, phcCompletionEvent };
  }
}
