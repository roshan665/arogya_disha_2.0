import {
  PhcDistrictHospitalCommunicationService,
  HospitalReferralStatus,
} from '../../lib/services/PhcDistrictHospitalCommunicationService';
import { RealtimeCommunicationService } from '../../lib/services/RealtimeCommunicationService';
import { supabase } from '../../lib/supabaseClient';

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../lib/services/RealtimeCommunicationService', () => ({
  RealtimeCommunicationService: {
    publishEvent: jest.fn(),
  },
}));

describe('PhcDistrictHospitalCommunicationService & Escalation Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. PHC CREATES REFERRAL -> DISTRICT HOSPITAL', () => {
    it('creates referral record with status CREATED and dispatches NEW_REFERRAL to target District Hospital', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'ref-100',
                patient_id: 'pat-roshan',
                source_facility_id: 'fac-phc-karjat',
                destination_facility_id: 'fac-dh-raigad',
                referring_doctor_id: 'u-doc-101',
                priority: 'RED',
                reason: 'Acute Coronary Syndrome',
                clinical_summary: 'ECG ST elevation in Lead II, III, aVF.',
                status: 'CREATED',
              },
              error: null,
            }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });
      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: 'evt-ref-100',
        type: 'NEW_REFERRAL',
      });

      const result = await PhcDistrictHospitalCommunicationService.createPhcReferral({
        patientId: 'pat-roshan',
        sourceFacilityId: 'fac-phc-karjat',
        destinationFacilityId: 'fac-dh-raigad',
        referringDoctorId: 'u-doc-101',
        priority: 'RED',
        reason: 'Acute Coronary Syndrome',
        clinicalSummary: 'ECG ST elevation in Lead II, III, aVF.',
      });

      expect(result.referral.id).toBe('ref-100');
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: 'NEW_REFERRAL',
        actorId: 'u-doc-101',
        actorRole: 'PHC',
        patientId: 'pat-roshan',
        relatedEntityId: 'ref-100',
        relatedEntityType: 'referral',
        recipientType: 'DISTRICT_HOSPITAL',
        recipientFacilityId: 'fac-dh-raigad',
      });
    });

    it('rejects referral creation if missing required fields', async () => {
      await expect(
        PhcDistrictHospitalCommunicationService.createPhcReferral({
          patientId: '',
          sourceFacilityId: 'fac-phc-karjat',
          destinationFacilityId: 'fac-dh-raigad',
          referringDoctorId: 'u-doc-101',
          priority: 'RED',
          reason: '',
          clinicalSummary: '',
        })
      ).rejects.toThrow('VALIDATION_ERROR');
    });
  });

  describe('2. DISTRICT HOSPITAL REFERRAL ACTIONS -> PHC', () => {
    const statuses: HospitalReferralStatus[] = [
      'RECEIVED',
      'UNDER_REVIEW',
      'ACCEPTED',
      'REJECTED',
      'APPOINTMENT_SCHEDULED',
      'IN_PROGRESS',
      'COMPLETED',
      'RETURNED_TO_PHC',
    ];

    it.each(statuses)('updates status to %s and notifies referring PHC in real time', async (status) => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'ref-100',
                  status,
                },
                error: null,
              }),
          }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });
      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: `evt-${status}`,
        type: `REFERRAL_${status}`,
      });

      const result = await PhcDistrictHospitalCommunicationService.updateReferralStatus({
        referralId: 'ref-100',
        patientId: 'pat-roshan',
        sourceFacilityId: 'fac-phc-karjat',
        destinationFacilityId: 'fac-dh-raigad',
        specialistId: 'u-dh-specialist-1',
        status,
      });

      expect(result.updated.status).toBe(status);
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: `REFERRAL_${status}`,
        actorId: 'u-dh-specialist-1',
        actorRole: 'DISTRICT_HOSPITAL',
        patientId: 'pat-roshan',
        relatedEntityId: 'ref-100',
        relatedEntityType: 'referral',
        recipientType: 'PHC',
        recipientFacilityId: 'fac-phc-karjat',
      });
    });

    it('fans out APPOINTMENT_SCHEDULED to Patient when District Hospital schedules appointment', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'ref-100',
                  status: 'APPOINTMENT_SCHEDULED',
                  scheduled_appointment_date: '2026-05-20',
                  scheduled_appointment_time: '10:30 AM',
                },
                error: null,
              }),
          }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });
      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: 'evt-apt-sch',
      });

      const result = await PhcDistrictHospitalCommunicationService.updateReferralStatus({
        referralId: 'ref-100',
        patientId: 'pat-roshan',
        sourceFacilityId: 'fac-phc-karjat',
        destinationFacilityId: 'fac-dh-raigad',
        specialistId: 'u-dh-specialist-1',
        status: 'APPOINTMENT_SCHEDULED',
        scheduledDate: '2026-05-20',
        scheduledTime: '10:30 AM',
      });

      expect(result.patientEvent).toBeDefined();
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: 'APPOINTMENT_SCHEDULED',
        actorId: 'u-dh-specialist-1',
        actorRole: 'DISTRICT_HOSPITAL',
        patientId: 'pat-roshan',
        relatedEntityId: 'ref-100',
        relatedEntityType: 'referral',
        recipientType: 'PATIENT',
        recipientUserId: 'pat-roshan',
      });
    });

    it('dispatches FOLLOW_UP_REQUIRED to ASHA when District Hospital completes treatment / returns to PHC', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'ref-100',
                  status: 'RETURNED_TO_PHC',
                },
                error: null,
              }),
          }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });
      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: 'evt-fu-req',
      });

      const result = await PhcDistrictHospitalCommunicationService.updateReferralStatus({
        referralId: 'ref-100',
        patientId: 'pat-roshan',
        sourceFacilityId: 'fac-phc-karjat',
        destinationFacilityId: 'fac-dh-raigad',
        specialistId: 'u-dh-specialist-1',
        status: 'RETURNED_TO_PHC',
        assignedAshaId: 'u-asha-101',
      });

      expect(result.ashaEvent).toBeDefined();
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: 'FOLLOW_UP_REQUIRED',
        actorId: 'fac-phc-karjat',
        actorRole: 'PHC',
        patientId: 'pat-roshan',
        relatedEntityId: 'ref-100',
        relatedEntityType: 'follow_up',
        recipientType: 'ASHA',
        recipientUserId: 'u-asha-101',
      });
    });
  });

  describe('3. ADDITIONAL INFORMATION WORKFLOW', () => {
    it('DH requests additional info and notifies referring PHC', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'ref-100',
                  status: 'ADDITIONAL_INFORMATION_REQUIRED',
                  additional_info_requested: 'Please provide latest serum creatinine.',
                },
                error: null,
              }),
          }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });
      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: 'evt-add-info-req',
      });

      const result = await PhcDistrictHospitalCommunicationService.requestAdditionalInformation({
        referralId: 'ref-100',
        patientId: 'pat-roshan',
        sourceFacilityId: 'fac-phc-karjat',
        destinationFacilityId: 'fac-dh-raigad',
        specialistId: 'u-dh-specialist-1',
        informationRequested: 'Please provide latest serum creatinine.',
      });

      expect(result.updated.status).toBe('ADDITIONAL_INFORMATION_REQUIRED');
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: 'ADDITIONAL_INFORMATION_REQUIRED',
        actorId: 'u-dh-specialist-1',
        actorRole: 'DISTRICT_HOSPITAL',
        patientId: 'pat-roshan',
        relatedEntityId: 'ref-100',
        relatedEntityType: 'referral',
        recipientType: 'PHC',
        recipientFacilityId: 'fac-phc-karjat',
      });
    });

    it('PHC responds with additional info and notifies District Hospital', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'ref-100',
                  status: 'UNDER_REVIEW',
                  additional_info_provided: 'Serum Creatinine: 1.1 mg/dL (Normal).',
                },
                error: null,
              }),
          }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });
      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: 'evt-add-info-sub',
      });

      const result = await PhcDistrictHospitalCommunicationService.submitAdditionalInformation({
        referralId: 'ref-100',
        patientId: 'pat-roshan',
        sourceFacilityId: 'fac-phc-karjat',
        destinationFacilityId: 'fac-dh-raigad',
        doctorId: 'u-doc-101',
        informationProvided: 'Serum Creatinine: 1.1 mg/dL (Normal).',
      });

      expect(result.updated.status).toBe('UNDER_REVIEW');
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: 'ADDITIONAL_INFORMATION_SUBMITTED',
        actorId: 'u-doc-101',
        actorRole: 'PHC',
        patientId: 'pat-roshan',
        relatedEntityId: 'ref-100',
        relatedEntityType: 'referral',
        recipientType: 'DISTRICT_HOSPITAL',
        recipientFacilityId: 'fac-dh-raigad',
      });
    });
  });
});
