import {
  PatientAshaCommunicationService,
} from '../../lib/services/PatientAshaCommunicationService';
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

describe('PatientAshaCommunicationService & Security Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. PATIENT -> ASHA: Assistance Request', () => {
    it('creates assistance request and dispatches NEW_PATIENT_REQUEST to assigned ASHA', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'req-1',
                patient_id: 'pat-roshan',
                asha_id: 'asha-sunita',
                request_type: 'HOME_VISIT',
                message: 'Please visit for ANC checkup guidance',
                status: 'PENDING',
              },
              error: null,
            }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });
      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: 'evt-req-1',
        type: 'NEW_PATIENT_REQUEST',
      });

      const result = await PatientAshaCommunicationService.requestAshaAssistance({
        patientId: 'pat-roshan',
        ashaId: 'asha-sunita',
        requestType: 'HOME_VISIT',
        message: 'Please visit for ANC checkup guidance',
      });

      expect(result.request.id).toBe('req-1');
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: 'NEW_PATIENT_REQUEST',
        actorId: 'pat-roshan',
        actorRole: 'PATIENT',
        patientId: 'pat-roshan',
        relatedEntityId: 'req-1',
        relatedEntityType: 'message',
        recipientType: 'ASHA',
        recipientUserId: 'asha-sunita',
      });
    });

    it('rejects assistance request if missing required parameters', async () => {
      await expect(
        PatientAshaCommunicationService.requestAshaAssistance({
          patientId: '',
          ashaId: 'asha-sunita',
          requestType: 'GENERAL',
          message: '',
        })
      ).rejects.toThrow('VALIDATION_ERROR');
    });
  });

  describe('2. ASHA -> PATIENT: Status Updates', () => {
    it.each([
      'ACCEPTED',
      'CONTACTED',
      'VISIT_SCHEDULED',
      'FOLLOW_UP_REQUIRED',
      'COMPLETED',
    ])('updates status to %s and notifies patient in real time', async (status) => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'req-1',
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
        type: `REQUEST_${status}`,
      });

      const result = await PatientAshaCommunicationService.updateAssistanceRequestStatus({
        requestId: 'req-1',
        patientId: 'pat-roshan',
        ashaId: 'asha-sunita',
        status: status as any,
      });

      expect(result.updated.status).toBe(status);
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: `REQUEST_${status}`,
        actorId: 'asha-sunita',
        actorRole: 'ASHA',
        patientId: 'pat-roshan',
        relatedEntityId: 'req-1',
        relatedEntityType: 'message',
        recipientType: 'PATIENT',
        recipientUserId: 'pat-roshan',
      });
    });
  });

  describe('3. ASHA Follow-Up & PHC Escalation', () => {
    it('records follow-up and notifies patient without leaking internal clinical notes', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'fu-1',
                patient_id: 'pat-roshan',
                asha_id: 'asha-sunita',
                public_patient_update: 'Home visit completed. Next checkup scheduled.',
                internal_asha_notes: 'Suspected mild anemia, Hb 10.2 gm/dL, IFA provided',
              },
              error: null,
            }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });
      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: 'evt-fu-1',
        type: 'ASHA_FOLLOWUP_RECORDED',
      });

      const result = await PatientAshaCommunicationService.recordAshaFollowUp({
        patientId: 'pat-roshan',
        ashaId: 'asha-sunita',
        followUpType: 'home_visit_completed',
        publicPatientUpdate: 'Home visit completed. Next checkup scheduled.',
        internalAshaNotes: 'Suspected mild anemia, Hb 10.2 gm/dL, IFA provided',
      });

      expect(result.followUp.id).toBe('fu-1');
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: 'ASHA_FOLLOWUP_RECORDED',
        actorId: 'asha-sunita',
        actorRole: 'ASHA',
        patientId: 'pat-roshan',
        relatedEntityId: 'fu-1',
        relatedEntityType: 'follow_up',
        recipientType: 'PATIENT',
        recipientUserId: 'pat-roshan',
      });
    });

    it('automatically escalates to supervising PHC if patient needs doctor consultation', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'fu-esc-1',
                patient_id: 'pat-roshan',
                asha_id: 'asha-sunita',
                escalate_to_phc: true,
                phc_facility_id: 'fac-phc-karjat',
              },
              error: null,
            }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });
      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: 'evt-esc-1',
        type: 'PHC_FOLLOWUP_REQUEST',
      });

      const result = await PatientAshaCommunicationService.recordAshaFollowUp({
        patientId: 'pat-roshan',
        ashaId: 'asha-sunita',
        followUpType: 'patient_needs_phc_consultation',
        publicPatientUpdate: 'Follow-up escalated to PHC Medical Officer.',
        internalAshaNotes: 'BP 150/95 mmHg, requires doctor review.',
        escalateToPhc: true,
        phcFacilityId: 'fac-phc-karjat',
      });

      expect(result.phcEvent).not.toBeNull();
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PHC_FOLLOWUP_REQUEST',
          actorId: 'asha-sunita',
          actorRole: 'ASHA',
          patientId: 'pat-roshan',
          recipientType: 'PHC',
          recipientFacilityId: 'fac-phc-karjat',
        })
      );
    });
  });
});
