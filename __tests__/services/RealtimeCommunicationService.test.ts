import {
  RealtimeCommunicationService,
  RealtimeEventAuthorizer,
  RealtimeHealthcareEvent,
  ContextUser,
} from '../../lib/services/RealtimeCommunicationService';
import { supabase } from '../../lib/supabaseClient';

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('RealtimeCommunicationService & Authorization Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Security & Payload Sanitization', () => {
    it('strips all sensitive medical records (diagnoses, prescriptions, vitals) from event payload', () => {
      const dirtyPayload: any = {
        type: 'REFERRAL_CREATED',
        actorId: 'doc-123',
        actorRole: 'PHC',
        patientId: 'pat-456',
        relatedEntityId: 'ref-789',
        relatedEntityType: 'referral',
        recipientType: 'DISTRICT_HOSPITAL',
        diagnosis: 'Acute Severe Myocardial Infarction',
        prescription: 'Aspirin 300mg, Clopidogrel 300mg',
        vitals: { bp: '190/110', spo2: 89 },
        clinical_notes: 'Patient in critical cardiogenic shock',
      };

      const sanitized = RealtimeCommunicationService.sanitizeEventPayload(dirtyPayload);

      expect((sanitized as any).diagnosis).toBeUndefined();
      expect((sanitized as any).prescription).toBeUndefined();
      expect((sanitized as any).vitals).toBeUndefined();
      expect((sanitized as any).clinical_notes).toBeUndefined();
      expect(sanitized.type).toBe('REFERRAL_CREATED');
      expect(sanitized.patientId).toBe('pat-456');
    });

    it('rejects invalid or unauthorized roles outside the 4 core roles', () => {
      expect(() => {
        RealtimeCommunicationService.sanitizeEventPayload({
          type: 'TEST_EVENT',
          actorId: 'user-1',
          actorRole: 'SUPER_ADMIN_INVALID' as any,
          patientId: 'pat-1',
          relatedEntityId: 'ent-1',
          relatedEntityType: 'appointment',
          recipientType: 'PATIENT',
        });
      }).toThrow('VALIDATION_ERROR: Invalid role specified.');
    });
  });

  describe('2. Event Publishing & Multi-Role Fanout', () => {
    it('publishes a minimal event directly to realtime_events table', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'evt-101',
                type: 'APPOINTMENT_BOOKED',
                actor_id: 'pat-1',
                actor_role: 'PATIENT',
                patient_id: 'pat-1',
                related_entity_id: 'apt-202',
                related_entity_type: 'appointment',
                recipient_type: 'ASHA',
                recipient_user_id: 'asha-1',
                recipient_facility_id: null,
                created_at: '2026-09-10T10:00:00Z',
              },
              error: null,
            }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const result = await RealtimeCommunicationService.publishEvent({
        type: 'APPOINTMENT_BOOKED',
        actorId: 'pat-1',
        actorRole: 'PATIENT',
        patientId: 'pat-1',
        relatedEntityId: 'apt-202',
        relatedEntityType: 'appointment',
        recipientType: 'ASHA',
        recipientUserId: 'asha-1',
      });

      expect(result.id).toBe('evt-101');
      expect(result.actorRole).toBe('PATIENT');
      expect(result.recipientType).toBe('ASHA');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'APPOINTMENT_BOOKED',
          actor_id: 'pat-1',
          actor_role: 'PATIENT',
          patient_id: 'pat-1',
          related_entity_id: 'apt-202',
          recipient_type: 'ASHA',
        })
      );
    });

    it('fans out discrete, individually authorized events to multiple stakeholders', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'evt-fanout',
                type: 'REFERRAL_SUBMITTED',
                actor_id: 'phc-doc-1',
                actor_role: 'PHC',
                patient_id: 'pat-10',
                related_entity_id: 'ref-999',
                related_entity_type: 'referral',
                recipient_type: 'DISTRICT_HOSPITAL',
                created_at: '2026-09-10T10:00:00Z',
              },
              error: null,
            }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const events = await RealtimeCommunicationService.fanoutEvent(
        {
          type: 'REFERRAL_SUBMITTED',
          actorId: 'phc-doc-1',
          actorRole: 'PHC',
          patientId: 'pat-10',
          relatedEntityId: 'ref-999',
          relatedEntityType: 'referral',
        },
        [
          { recipientType: 'DISTRICT_HOSPITAL', recipientFacilityId: 'fac-dh-1' },
          { recipientType: 'ASHA', recipientUserId: 'asha-worker-1' },
          { recipientType: 'PATIENT', recipientUserId: 'pat-10' },
        ]
      );

      expect(events.length).toBe(3);
      expect(mockInsert).toHaveBeenCalledTimes(3);
    });
  });

  describe('3. Role Access Scope & Five-Question Authorization Engine', () => {
    const baseEvent: RealtimeHealthcareEvent = {
      id: 'evt-1',
      type: 'REFERRAL_ACCEPTED',
      actorId: 'dh-doc-1',
      actorRole: 'DISTRICT_HOSPITAL',
      patientId: 'pat-100',
      relatedEntityId: 'ref-200',
      relatedEntityType: 'referral',
      recipientType: 'ASHA',
      recipientUserId: 'asha-1',
      timestamp: '2026-09-10T10:00:00Z',
    };

    it('PATIENT scope: allows delivery only if the patient is the subject or direct recipient', () => {
      const patientEvent: RealtimeHealthcareEvent = {
        ...baseEvent,
        recipientType: 'PATIENT',
        patientId: 'pat-roshan',
        recipientUserId: 'pat-roshan',
      };

      const authorizedPatient: ContextUser = {
        userId: 'pat-roshan',
        role: 'PATIENT',
      };

      const unauthorizedPatient: ContextUser = {
        userId: 'pat-other-user',
        role: 'PATIENT',
      };

      expect(RealtimeEventAuthorizer.isAuthorizedRecipient(patientEvent, authorizedPatient)).toBe(true);
      expect(RealtimeEventAuthorizer.isAuthorizedRecipient(patientEvent, unauthorizedPatient)).toBe(false);
    });

    it('ASHA scope: allows delivery only if patient is assigned to this ASHA or direct recipient', () => {
      const ashaEvent: RealtimeHealthcareEvent = {
        ...baseEvent,
        recipientType: 'ASHA',
        patientId: 'pat-assigned',
        recipientUserId: undefined,
      };

      const assignedAsha: ContextUser = {
        userId: 'asha-sunita',
        role: 'ASHA',
        assignedPatientIds: ['pat-assigned', 'pat-another'],
      };

      const unassignedAsha: ContextUser = {
        userId: 'asha-other',
        role: 'ASHA',
        assignedPatientIds: ['pat-different'],
      };

      expect(RealtimeEventAuthorizer.isAuthorizedRecipient(ashaEvent, assignedAsha)).toBe(true);
      expect(RealtimeEventAuthorizer.isAuthorizedRecipient(ashaEvent, unassignedAsha)).toBe(false);
    });

    it('PHC scope: allows delivery only if target facility or patient is under PHC active care', () => {
      const phcEvent: RealtimeHealthcareEvent = {
        ...baseEvent,
        recipientType: 'PHC',
        patientId: 'pat-phc-care',
        recipientFacilityId: 'fac-phc-karjat',
      };

      const phcStaff: ContextUser = {
        userId: 'doc-amit',
        role: 'PHC',
        facilityId: 'fac-phc-karjat',
      };

      const otherPhcStaff: ContextUser = {
        userId: 'doc-other',
        role: 'PHC',
        facilityId: 'fac-phc-pune',
      };

      expect(RealtimeEventAuthorizer.isAuthorizedRecipient(phcEvent, phcStaff)).toBe(true);
      expect(RealtimeEventAuthorizer.isAuthorizedRecipient(phcEvent, otherPhcStaff)).toBe(false);
    });

    it('DISTRICT_HOSPITAL scope: allows delivery only if target hospital matches facility or active referral', () => {
      const dhEvent: RealtimeHealthcareEvent = {
        ...baseEvent,
        recipientType: 'DISTRICT_HOSPITAL',
        patientId: 'pat-referred',
        recipientFacilityId: 'fac-dh-raigad',
      };

      const dhStaff: ContextUser = {
        userId: 'spec-rajesh',
        role: 'DISTRICT_HOSPITAL',
        facilityId: 'fac-dh-raigad',
      };

      const otherDhStaff: ContextUser = {
        userId: 'spec-other',
        role: 'DISTRICT_HOSPITAL',
        facilityId: 'fac-dh-thane',
      };

      expect(RealtimeEventAuthorizer.isAuthorizedRecipient(dhEvent, dhStaff)).toBe(true);
      expect(RealtimeEventAuthorizer.isAuthorizedRecipient(dhEvent, otherDhStaff)).toBe(false);
    });

    it('Role mismatch: rejects delivery if user role does not match recipient type', () => {
      const phcUser: ContextUser = {
        userId: 'doc-amit',
        role: 'PHC',
        facilityId: 'fac-phc-karjat',
      };

      const ashaEvent: RealtimeHealthcareEvent = {
        ...baseEvent,
        recipientType: 'ASHA',
      };

      expect(RealtimeEventAuthorizer.isAuthorizedRecipient(ashaEvent, phcUser)).toBe(false);
    });
  });
});
