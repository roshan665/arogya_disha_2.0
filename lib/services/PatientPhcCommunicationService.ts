import { supabase } from '../supabaseClient';
import {
  RealtimeCommunicationService,
  RealtimeHealthcareEvent,
} from './RealtimeCommunicationService';

export type PhcAppointmentStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'RESCHEDULED'
  | 'CANCELLED'
  | 'CHECKED_IN'
  | 'COMPLETED'
  | 'NO_SHOW';

export interface RequestPhcAppointmentParams {
  patientId: string;
  phcFacilityId: string;
  consultType: string;
  preferredDate: string; // YYYY-MM-DD
  preferredTimeSlot: string; // e.g. '10:00 AM'
  notes?: string;
}

export interface UpdatePhcAppointmentStatusParams {
  appointmentId: string;
  patientId: string;
  phcFacilityId: string;
  doctorId?: string;
  status: PhcAppointmentStatus;
  rescheduledDate?: string;
  rescheduledTimeSlot?: string;
}

export interface PatientCheckInParams {
  appointmentId: string;
  patientId: string;
  phcFacilityId: string;
}

export interface CompletePhcConsultationParams {
  appointmentId?: string;
  patientId: string;
  phcFacilityId: string;
  doctorId: string;
  publicSummary: string;
  internalClinicalNotes?: string;
}

export interface DiagnosticReportNotificationParams {
  reportId: string;
  patientId: string;
  phcFacilityId: string;
  testType: string;
  reportTitle: string;
}

export class PatientPhcCommunicationService {
  /**
   * 1. PATIENT -> PHC: Appointment Request
   * Creates an appointment request and notifies the authorized PHC in real time.
   */
  static async requestPhcAppointment(params: RequestPhcAppointmentParams): Promise<{
    appointment: any;
    event: RealtimeHealthcareEvent;
  }> {
    if (!params.patientId || !params.phcFacilityId || !params.preferredDate || !params.preferredTimeSlot) {
      throw new Error('VALIDATION_ERROR: Missing required appointment request parameters (patientId, phcFacilityId, preferredDate, preferredTimeSlot).');
    }

    const { data: appointment, error } = await supabase
      .from('phc_appointments')
      .insert({
        patient_id: params.patientId,
        facility_id: params.phcFacilityId,
        status: 'REQUESTED',
        consult_type: params.consultType || 'General OPD',
        preferred_date: params.preferredDate,
        preferred_time_slot: params.preferredTimeSlot,
        notes: params.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create PHC appointment request in DB:', error);
      throw new Error(`APPOINTMENT_REQUEST_FAILED: ${error.message}`);
    }

    // Realtime event: PATIENT -> PHC (APPOINTMENT_REQUESTED)
    const event = await RealtimeCommunicationService.publishEvent({
      type: 'APPOINTMENT_REQUESTED',
      actorId: params.patientId,
      actorRole: 'PATIENT',
      patientId: params.patientId,
      relatedEntityId: appointment.id,
      relatedEntityType: 'appointment',
      recipientType: 'PHC',
      recipientFacilityId: params.phcFacilityId,
    });

    return { appointment, event };
  }

  /**
   * 2. PHC -> PATIENT: Appointment Status Lifecycle
   * Updates appointment status (CONFIRMED, RESCHEDULED, CANCELLED, CHECKED_IN, COMPLETED, NO_SHOW)
   * and notifies the patient in real time.
   */
  static async updateAppointmentStatus(params: UpdatePhcAppointmentStatusParams): Promise<{
    updated: any;
    event: RealtimeHealthcareEvent;
  }> {
    if (!params.appointmentId || !params.patientId || !params.phcFacilityId || !params.status) {
      throw new Error('VALIDATION_ERROR: Missing required fields to update appointment status.');
    }

    const validStatuses: PhcAppointmentStatus[] = [
      'REQUESTED',
      'CONFIRMED',
      'RESCHEDULED',
      'CANCELLED',
      'CHECKED_IN',
      'COMPLETED',
      'NO_SHOW',
    ];

    if (!validStatuses.includes(params.status)) {
      throw new Error(`VALIDATION_ERROR: Invalid status "${params.status}". Allowed statuses: ${validStatuses.join(', ')}`);
    }

    const updatePayload: any = {
      status: params.status,
      updated_at: new Date().toISOString(),
    };

    if (params.doctorId) {
      updatePayload.doctor_id = params.doctorId;
    }
    if (params.rescheduledDate) {
      updatePayload.preferred_date = params.rescheduledDate;
    }
    if (params.rescheduledTimeSlot) {
      updatePayload.preferred_time_slot = params.rescheduledTimeSlot;
    }

    const { data: updated, error } = await supabase
      .from('phc_appointments')
      .update(updatePayload)
      .eq('id', params.appointmentId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update PHC appointment in DB:', error);
      throw new Error(`UPDATE_APPOINTMENT_FAILED: ${error.message}`);
    }

    // Realtime event: PHC -> PATIENT (e.g. APPOINTMENT_CONFIRMED, APPOINTMENT_RESCHEDULED, APPOINTMENT_CANCELLED, etc.)
    const eventType = `APPOINTMENT_${params.status}`;
    const event = await RealtimeCommunicationService.publishEvent({
      type: eventType,
      actorId: params.doctorId || params.phcFacilityId,
      actorRole: 'PHC',
      patientId: params.patientId,
      relatedEntityId: params.appointmentId,
      relatedEntityType: 'appointment',
      recipientType: 'PATIENT',
      recipientUserId: params.patientId,
    });

    return { updated, event };
  }

  /**
   * 3. PATIENT -> PHC: Patient Check-In
   * When a patient arrives at the PHC and checks in, notifies the PHC triage/OPD queue immediately.
   */
  static async checkInPatient(params: PatientCheckInParams): Promise<{
    updated: any;
    event: RealtimeHealthcareEvent;
  }> {
    if (!params.appointmentId || !params.patientId || !params.phcFacilityId) {
      throw new Error('VALIDATION_ERROR: Missing required fields for patient check-in.');
    }

    const { data: updated, error } = await supabase
      .from('phc_appointments')
      .update({
        status: 'CHECKED_IN',
        check_in_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.appointmentId)
      .select()
      .single();

    if (error) {
      console.error('Failed to check in patient in DB:', error);
      throw new Error(`PATIENT_CHECKIN_FAILED: ${error.message}`);
    }

    // Realtime event: PATIENT -> PHC (PATIENT_CHECKED_IN)
    const event = await RealtimeCommunicationService.publishEvent({
      type: 'PATIENT_CHECKED_IN',
      actorId: params.patientId,
      actorRole: 'PATIENT',
      patientId: params.patientId,
      relatedEntityId: params.appointmentId,
      relatedEntityType: 'appointment',
      recipientType: 'PHC',
      recipientFacilityId: params.phcFacilityId,
    });

    return { updated, event };
  }

  /**
   * 4. PHC -> PATIENT: Consultation Completion
   * Completes consultation and notifies patient with a patient-facing update.
   * STRICT SECURITY REQUIREMENT: Never exposes internal doctor clinical notes through the notification.
   */
  static async completeConsultation(params: CompletePhcConsultationParams): Promise<{
    consultation: any;
    event: RealtimeHealthcareEvent;
  }> {
    if (!params.patientId || !params.phcFacilityId || !params.doctorId || !params.publicSummary) {
      throw new Error('VALIDATION_ERROR: Missing required fields to complete consultation (patientId, phcFacilityId, doctorId, publicSummary).');
    }

    const { data: consultation, error } = await supabase
      .from('phc_consultations')
      .insert({
        appointment_id: params.appointmentId || null,
        patient_id: params.patientId,
        facility_id: params.phcFacilityId,
        doctor_id: params.doctorId,
        public_summary: params.publicSummary,
        internal_clinical_notes: params.internalClinicalNotes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save consultation record in DB:', error);
      throw new Error(`SAVE_CONSULTATION_FAILED: ${error.message}`);
    }

    // If linked to an appointment, mark appointment as COMPLETED
    if (params.appointmentId) {
      await supabase
        .from('phc_appointments')
        .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
        .eq('id', params.appointmentId);
    }

    // Realtime event: PHC -> PATIENT (CONSULTATION_COMPLETED)
    // Payloads strictly contain only metadata identifiers; internal notes are excluded.
    const event = await RealtimeCommunicationService.publishEvent({
      type: 'CONSULTATION_COMPLETED',
      actorId: params.doctorId,
      actorRole: 'PHC',
      patientId: params.patientId,
      relatedEntityId: consultation.id,
      relatedEntityType: 'consultation',
      recipientType: 'PATIENT',
      recipientUserId: params.patientId,
    });

    return { consultation, event };
  }

  /**
   * 5. DIAGNOSTIC REPORT: PHC & PATIENT Realtime Notifications
   * When an authorized diagnostic report is ready:
   * - PHC receives `DIAGNOSTIC_REPORT_AVAILABLE`
   * - Patient receives `REPORT_AVAILABLE`
   * Minimal payload only, zero raw test values or clinical record leaks.
   */
  static async notifyDiagnosticReportAvailable(params: DiagnosticReportNotificationParams): Promise<{
    phcEvent: RealtimeHealthcareEvent;
    patientEvent: RealtimeHealthcareEvent;
  }> {
    if (!params.reportId || !params.patientId || !params.phcFacilityId) {
      throw new Error('VALIDATION_ERROR: Missing required fields for diagnostic report notification.');
    }

    // 1. Publish minimal event to PHC
    const phcEvent = await RealtimeCommunicationService.publishEvent({
      type: 'DIAGNOSTIC_REPORT_AVAILABLE',
      actorId: params.phcFacilityId,
      actorRole: 'PHC',
      patientId: params.patientId,
      relatedEntityId: params.reportId,
      relatedEntityType: 'diagnostic',
      recipientType: 'PHC',
      recipientFacilityId: params.phcFacilityId,
    });

    // 2. Publish minimal event to Patient
    const patientEvent = await RealtimeCommunicationService.publishEvent({
      type: 'REPORT_AVAILABLE',
      actorId: params.phcFacilityId,
      actorRole: 'PHC',
      patientId: params.patientId,
      relatedEntityId: params.reportId,
      relatedEntityType: 'diagnostic',
      recipientType: 'PATIENT',
      recipientUserId: params.patientId,
    });

    return { phcEvent, patientEvent };
  }
}
