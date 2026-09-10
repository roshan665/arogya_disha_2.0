import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthcareJourneyLoopService } from '../../lib/services/HealthcareJourneyLoopService';
import { RealtimeCommunicationService } from '../../lib/services/RealtimeCommunicationService';
import { PatientAshaCommunicationService } from '../../lib/services/PatientAshaCommunicationService';
import { PatientPhcCommunicationService } from '../../lib/services/PatientPhcCommunicationService';
import { PhcDistrictHospitalCommunicationService } from '../../lib/services/PhcDistrictHospitalCommunicationService';

describe('HealthcareJourneyLoopService (7-Step Complete Loop)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('STEP 1 — PATIENT: Request assistance or appointment', () => {
    it('dispatches assistance request to ASHA and appointment request to PHC', async () => {
      const mockAshaReq = vi.spyOn(PatientAshaCommunicationService, 'requestAshaAssistance').mockResolvedValue({
        request: { id: 'req-101', patient_id: 'pat-1', asha_id: 'asha-1', status: 'PENDING', request_type: 'HELP', message: 'Need help', created_at: new Date().toISOString() },
        event: {
          id: 'evt-1',
          type: 'NEW_PATIENT_REQUEST',
          actorId: 'pat-1',
          actorRole: 'PATIENT',
          patientId: 'pat-1',
          relatedEntityId: 'req-101',
          relatedEntityType: 'assistance_request',
          recipientType: 'ASHA',
          recipientUserId: 'asha-1',
          timestamp: new Date().toISOString(),
        },
      });

      const mockPhcReq = vi.spyOn(PatientPhcCommunicationService, 'requestPhcAppointment').mockResolvedValue({
        appointment: { id: 'apt-101', patient_id: 'pat-1', phc_facility_id: 'fac-phc-1', status: 'REQUESTED', consult_type: 'OPD', preferred_date: '2026-05-20', preferred_time_slot: '10:00 AM', created_at: new Date().toISOString() },
        event: {
          id: 'evt-2',
          type: 'APPOINTMENT_REQUESTED',
          actorId: 'pat-1',
          actorRole: 'PATIENT',
          patientId: 'pat-1',
          relatedEntityId: 'apt-101',
          relatedEntityType: 'appointment',
          recipientType: 'PHC',
          recipientFacilityId: 'fac-phc-1',
          timestamp: new Date().toISOString(),
        },
      });

      const res = await HealthcareJourneyLoopService.step1_patientInitiate({
        patientId: 'pat-1',
        ashaId: 'asha-1',
        phcFacilityId: 'fac-phc-1',
        requestType: 'OPD Consultation',
        message: 'Patient experiencing persistent fever',
      });

      expect(mockAshaReq).toHaveBeenCalledWith({
        patientId: 'pat-1',
        ashaId: 'asha-1',
        requestType: 'OPD Consultation',
        message: 'Patient experiencing persistent fever',
      });
      expect(mockPhcReq).toHaveBeenCalled();
      expect(res.ashaEvent?.type).toBe('NEW_PATIENT_REQUEST');
      expect(res.phcEvent?.type).toBe('APPOINTMENT_REQUESTED');
    });
  });

  describe('STEP 2 — ASHA: Community evaluation & escalation', () => {
    it('handles NO_FURTHER_ACTION and FOLLOW_UP_REQUIRED without PHC escalation', async () => {
      vi.spyOn(PatientAshaCommunicationService, 'recordAshaFollowUp').mockResolvedValue({
        followUp: { id: 'fu-1', patient_id: 'pat-1', asha_id: 'asha-1', follow_up_type: 'home_visit_completed', public_patient_update: 'Vitals stable', created_at: new Date().toISOString() },
        patientEvent: {
          id: 'evt-fu-1',
          type: 'ASHA_FOLLOWUP_RECORDED',
          actorId: 'asha-1',
          actorRole: 'ASHA',
          patientId: 'pat-1',
          relatedEntityId: 'fu-1',
          relatedEntityType: 'follow_up',
          recipientType: 'PATIENT',
          recipientUserId: 'pat-1',
          timestamp: new Date().toISOString(),
        },
      });

      const res = await HealthcareJourneyLoopService.step2_ashaEvaluate({
        patientId: 'pat-1',
        ashaId: 'asha-1',
        phcFacilityId: 'fac-phc-1',
        outcome: 'NO_FURTHER_ACTION',
        publicPatientUpdate: 'Vitals normal, rest advised.',
      });

      expect(res.patientEvent.type).toBe('ASHA_FOLLOWUP_RECORDED');
      expect(res.phcEvent).toBeUndefined();
    });

    it('escalates to PHC when outcome is PHC_ATTENTION_REQUIRED', async () => {
      vi.spyOn(PatientAshaCommunicationService, 'recordAshaFollowUp').mockResolvedValue({
        followUp: { id: 'fu-2', patient_id: 'pat-1', asha_id: 'asha-1', follow_up_type: 'patient_needs_phc_consultation', public_patient_update: 'Escalated to PHC', created_at: new Date().toISOString() },
        patientEvent: {
          id: 'evt-fu-pat',
          type: 'ASHA_FOLLOWUP_RECORDED',
          actorId: 'asha-1',
          actorRole: 'ASHA',
          patientId: 'pat-1',
          relatedEntityId: 'fu-2',
          relatedEntityType: 'follow_up',
          recipientType: 'PATIENT',
          recipientUserId: 'pat-1',
          timestamp: new Date().toISOString(),
        },
        phcEvent: {
          id: 'evt-fu-phc',
          type: 'PHC_FOLLOWUP_REQUEST',
          actorId: 'asha-1',
          actorRole: 'ASHA',
          patientId: 'pat-1',
          relatedEntityId: 'fu-2',
          relatedEntityType: 'follow_up',
          recipientType: 'PHC',
          recipientFacilityId: 'fac-phc-1',
          timestamp: new Date().toISOString(),
        },
      });

      const res = await HealthcareJourneyLoopService.step2_ashaEvaluate({
        patientId: 'pat-1',
        ashaId: 'asha-1',
        phcFacilityId: 'fac-phc-1',
        outcome: 'PHC_ATTENTION_REQUIRED',
        publicPatientUpdate: 'Doctor consultation initiated.',
        internalAshaNotes: 'Severe edema and BP 170/110',
      });

      expect(res.patientEvent.type).toBe('ASHA_FOLLOWUP_RECORDED');
      expect(res.phcEvent?.type).toBe('PHC_FOLLOWUP_REQUEST');
      expect(res.phcEvent?.recipientFacilityId).toBe('fac-phc-1');
    });
  });

  describe('STEP 3 — PHC: Evaluate & Refer to District Hospital', () => {
    it('handles PHC local treatment without referral', async () => {
      vi.spyOn(PatientPhcCommunicationService, 'completeConsultation').mockResolvedValue({
        consultation: { id: 'con-1', patient_id: 'pat-1', phc_facility_id: 'fac-phc-1', doctor_id: 'doc-1', public_summary: 'Prescribed medication', status: 'COMPLETED', created_at: new Date().toISOString() },
        event: {
          id: 'evt-con-1',
          type: 'CONSULTATION_COMPLETED',
          actorId: 'doc-1',
          actorRole: 'PHC',
          patientId: 'pat-1',
          relatedEntityId: 'con-1',
          relatedEntityType: 'consultation',
          recipientType: 'PATIENT',
          recipientUserId: 'pat-1',
          timestamp: new Date().toISOString(),
        },
      });

      const res = await HealthcareJourneyLoopService.step3_phcEvaluate({
        patientId: 'pat-1',
        doctorId: 'doc-1',
        phcFacilityId: 'fac-phc-1',
        outcome: 'TREATMENT_AT_PHC',
        clinicalSummary: 'Treated for mild bronchitis',
        publicPatientSummary: 'Medication prescribed. Rest for 3 days.',
      });

      expect(res.phcConsultationEvent?.type).toBe('CONSULTATION_COMPLETED');
      expect(res.dhReferralEvent).toBeUndefined();
    });

    it('creates referral to District Hospital and notifies patient when REFER_TO_DISTRICT_HOSPITAL', async () => {
      vi.spyOn(PhcDistrictHospitalCommunicationService, 'createPhcReferral').mockResolvedValue({
        referral: { id: 'ref-1', patient_id: 'pat-1', source_facility_id: 'fac-phc-1', destination_facility_id: 'fac-dh-1', referring_doctor_id: 'doc-1', priority: 'RED', reason: 'Cardiac eval', clinical_summary: 'ECG ST Elevation', status: 'CREATED', created_at: new Date().toISOString() },
        event: {
          id: 'evt-ref-1',
          type: 'NEW_REFERRAL',
          actorId: 'doc-1',
          actorRole: 'PHC',
          patientId: 'pat-1',
          relatedEntityId: 'ref-1',
          relatedEntityType: 'referral',
          recipientType: 'DISTRICT_HOSPITAL',
          recipientFacilityId: 'fac-dh-1',
          timestamp: new Date().toISOString(),
        },
      });

      vi.spyOn(RealtimeCommunicationService, 'publishEvent').mockResolvedValue({
        id: 'evt-pat-ref',
        type: 'PATIENT_REFERRED_TO_HOSPITAL',
        actorId: 'doc-1',
        actorRole: 'PHC',
        patientId: 'pat-1',
        relatedEntityId: 'ref-1',
        relatedEntityType: 'referral',
        recipientType: 'PATIENT',
        recipientUserId: 'pat-1',
        timestamp: new Date().toISOString(),
      });

      const res = await HealthcareJourneyLoopService.step3_phcEvaluate({
        patientId: 'pat-1',
        doctorId: 'doc-1',
        phcFacilityId: 'fac-phc-1',
        destinationDhFacilityId: 'fac-dh-1',
        outcome: 'REFER_TO_DISTRICT_HOSPITAL',
        priority: 'RED',
        reason: 'Suspected ACS',
        clinicalSummary: 'ECG changes noted in leads II, III, aVF',
        publicPatientSummary: 'Referred to District Hospital Cardiology',
      });

      expect(res.dhReferralEvent?.type).toBe('NEW_REFERRAL');
      expect(res.dhReferralEvent?.recipientFacilityId).toBe('fac-dh-1');
      expect(res.patientNotificationEvent?.type).toBe('PATIENT_REFERRED_TO_HOSPITAL');
      expect(res.patientNotificationEvent?.recipientUserId).toBe('pat-1');
    });
  });

  describe('STEP 4 — DISTRICT HOSPITAL: Review referral outcomes', () => {
    it('handles ADDITIONAL_INFORMATION_REQUIRED loop', async () => {
      vi.spyOn(PhcDistrictHospitalCommunicationService, 'requestAdditionalInformation').mockResolvedValue({
        event: {
          id: 'evt-add-info',
          type: 'ADDITIONAL_INFORMATION_REQUIRED',
          actorId: 'spec-1',
          actorRole: 'DISTRICT_HOSPITAL',
          patientId: 'pat-1',
          relatedEntityId: 'ref-1',
          relatedEntityType: 'referral',
          recipientType: 'PHC',
          recipientFacilityId: 'fac-phc-1',
          timestamp: new Date().toISOString(),
        },
      });

      const res = await HealthcareJourneyLoopService.step4_districtHospitalProcess({
        referralId: 'ref-1',
        patientId: 'pat-1',
        dhFacilityId: 'fac-dh-1',
        phcFacilityId: 'fac-phc-1',
        specialistId: 'spec-1',
        outcome: 'ADDITIONAL_INFORMATION_REQUIRED',
        informationRequested: 'Need echocardiogram report before admission.',
      });

      expect(res.phcEvent.type).toBe('ADDITIONAL_INFORMATION_REQUIRED');
      expect(res.phcEvent.recipientFacilityId).toBe('fac-phc-1');
    });

    it('handles ACCEPTED outcome and notifies both PHC and Patient', async () => {
      vi.spyOn(PhcDistrictHospitalCommunicationService, 'updateReferralStatus').mockResolvedValue({
        updated: { id: 'ref-1', status: 'ACCEPTED' },
        phcEvent: {
          id: 'evt-acc-phc',
          type: 'REFERRAL_ACCEPTED',
          actorId: 'spec-1',
          actorRole: 'DISTRICT_HOSPITAL',
          patientId: 'pat-1',
          relatedEntityId: 'ref-1',
          relatedEntityType: 'referral',
          recipientType: 'PHC',
          recipientFacilityId: 'fac-phc-1',
          timestamp: new Date().toISOString(),
        },
      });

      vi.spyOn(RealtimeCommunicationService, 'publishEvent').mockResolvedValue({
        id: 'evt-acc-pat',
        type: 'REFERRAL_ACCEPTED',
        actorId: 'spec-1',
        actorRole: 'DISTRICT_HOSPITAL',
        patientId: 'pat-1',
        relatedEntityId: 'ref-1',
        relatedEntityType: 'referral',
        recipientType: 'PATIENT',
        recipientUserId: 'pat-1',
        timestamp: new Date().toISOString(),
      });

      const res = await HealthcareJourneyLoopService.step4_districtHospitalProcess({
        referralId: 'ref-1',
        patientId: 'pat-1',
        dhFacilityId: 'fac-dh-1',
        phcFacilityId: 'fac-phc-1',
        specialistId: 'spec-1',
        outcome: 'ACCEPTED',
      });

      expect(res.phcEvent.type).toBe('REFERRAL_ACCEPTED');
      expect(res.patientEvent?.type).toBe('REFERRAL_ACCEPTED');
      expect(res.patientEvent?.recipientUserId).toBe('pat-1');
    });
  });

  describe('STEP 5 — RETURN TO PHC: Specialist completes referral and returns outcome', () => {
    it('returns referral to PHC and sends patient-facing completion notification', async () => {
      vi.spyOn(PhcDistrictHospitalCommunicationService, 'updateReferralStatus').mockResolvedValue({
        updated: { id: 'ref-1', status: 'RETURNED_TO_PHC', treatment_summary: 'Angioplasty done', follow_up_instructions: 'Weekly BP check' },
        phcEvent: {
          id: 'evt-ret-phc',
          type: 'REFERRAL_RETURNED_TO_PHC',
          actorId: 'spec-1',
          actorRole: 'DISTRICT_HOSPITAL',
          patientId: 'pat-1',
          relatedEntityId: 'ref-1',
          relatedEntityType: 'referral',
          recipientType: 'PHC',
          recipientFacilityId: 'fac-phc-1',
          timestamp: new Date().toISOString(),
        },
      });

      vi.spyOn(RealtimeCommunicationService, 'publishEvent').mockResolvedValue({
        id: 'evt-comp-pat',
        type: 'HOSPITAL_TREATMENT_COMPLETED',
        actorId: 'spec-1',
        actorRole: 'DISTRICT_HOSPITAL',
        patientId: 'pat-1',
        relatedEntityId: 'ref-1',
        relatedEntityType: 'referral',
        recipientType: 'PATIENT',
        recipientUserId: 'pat-1',
        timestamp: new Date().toISOString(),
      });

      const res = await HealthcareJourneyLoopService.step5_districtHospitalReturnToPhc({
        referralId: 'ref-1',
        patientId: 'pat-1',
        dhFacilityId: 'fac-dh-1',
        phcFacilityId: 'fac-phc-1',
        specialistId: 'spec-1',
        treatmentSummary: 'Coronary angioplasty successful. Stable on dual antiplatelet therapy.',
        followUpInstructions: 'BP check twice weekly, medication compliance monitoring.',
      });

      expect(res.phcOutcomeEvent.type).toBe('REFERRAL_RETURNED_TO_PHC');
      expect(res.patientOutcomeEvent.type).toBe('HOSPITAL_TREATMENT_COMPLETED');
      expect(res.patientOutcomeEvent.recipientUserId).toBe('pat-1');
    });
  });

  describe('STEP 6 — ASHA FOLLOW-UP: PHC assigns community follow-up task', () => {
    it('creates ASHA follow-up task and notifies patient that follow-up is due', async () => {
      const publishSpy = vi.spyOn(RealtimeCommunicationService, 'publishEvent')
        .mockResolvedValueOnce({
          id: 'evt-task-asha',
          type: 'COMMUNITY_FOLLOW_UP_ASSIGNED',
          actorId: 'fac-phc-1',
          actorRole: 'PHC',
          patientId: 'pat-1',
          relatedEntityId: 'task-fu-1',
          relatedEntityType: 'follow_up',
          recipientType: 'ASHA',
          recipientUserId: 'asha-1',
          timestamp: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          id: 'evt-due-pat',
          type: 'FOLLOW_UP_DUE',
          actorId: 'fac-phc-1',
          actorRole: 'PHC',
          patientId: 'pat-1',
          relatedEntityId: 'task-fu-1',
          relatedEntityType: 'follow_up',
          recipientType: 'PATIENT',
          recipientUserId: 'pat-1',
          timestamp: new Date().toISOString(),
        });

      const res = await HealthcareJourneyLoopService.step6_phcAssignAshaFollowUp({
        patientId: 'pat-1',
        phcFacilityId: 'fac-phc-1',
        ashaId: 'asha-1',
        instructions: 'Check BP and antiplatelet compliance.',
        dueDate: '2026-05-25',
      });

      expect(publishSpy).toHaveBeenCalledTimes(2);
      expect(res.ashaTaskEvent.type).toBe('COMMUNITY_FOLLOW_UP_ASSIGNED');
      expect(res.ashaTaskEvent.recipientUserId).toBe('asha-1');
      expect(res.patientFollowUpDueEvent.type).toBe('FOLLOW_UP_DUE');
      expect(res.patientFollowUpDueEvent.recipientUserId).toBe('pat-1');
    });
  });

  describe('STEP 7 — PATIENT: ASHA completes follow-up visit & loop closure', () => {
    it('notifies patient of visit completion and updates PHC with shielded internal notes', async () => {
      const publishSpy = vi.spyOn(RealtimeCommunicationService, 'publishEvent')
        .mockResolvedValueOnce({
          id: 'evt-done-pat',
          type: 'HOME_VISIT_COMPLETED',
          actorId: 'asha-1',
          actorRole: 'ASHA',
          patientId: 'pat-1',
          relatedEntityId: 'task-fu-1',
          relatedEntityType: 'follow_up',
          recipientType: 'PATIENT',
          recipientUserId: 'pat-1',
          timestamp: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          id: 'evt-done-phc',
          type: 'ASHA_FOLLOWUP_COMPLETED',
          actorId: 'asha-1',
          actorRole: 'ASHA',
          patientId: 'pat-1',
          relatedEntityId: 'task-fu-1',
          relatedEntityType: 'follow_up',
          recipientType: 'PHC',
          recipientFacilityId: 'fac-phc-1',
          timestamp: new Date().toISOString(),
        });

      const res = await HealthcareJourneyLoopService.step7_ashaCompleteFollowUpTask({
        taskId: 'task-fu-1',
        patientId: 'pat-1',
        ashaId: 'asha-1',
        phcFacilityId: 'fac-phc-1',
        publicPatientUpdate: 'Home visit completed. BP 124/82, medication taken on time.',
        internalAshaNotes: 'CONFIDENTIAL: Patient is compliant, no chest pain reported.',
      });

      expect(publishSpy).toHaveBeenCalledTimes(2);
      expect(res.patientCompletionEvent.type).toBe('HOME_VISIT_COMPLETED');
      expect(res.patientCompletionEvent.recipientUserId).toBe('pat-1');
      expect(res.phcCompletionEvent.type).toBe('ASHA_FOLLOWUP_COMPLETED');
      expect(res.phcCompletionEvent.recipientFacilityId).toBe('fac-phc-1');
    });
  });
});
