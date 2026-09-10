import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RoleBasedMessagingService,
  UserMessagingContext,
  ConversationRecord,
} from '../../lib/services/RoleBasedMessagingService';
import { RealtimeCommunicationService } from '../../lib/services/RealtimeCommunicationService';
import { supabase } from '../../lib/supabaseClient';

describe('RoleBasedMessagingService (Restricted Healthcare Messaging)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Allowed Communication Validation Rules', () => {
    it('1.1 allows PATIENT <-> ASSIGNED ASHA', () => {
      const patientContext: UserMessagingContext = {
        userId: 'pat-100',
        role: 'PATIENT',
      };

      expect(() => {
        RoleBasedMessagingService.validateChannelAuthorization({
          channelType: 'PATIENT_ASHA',
          patientId: 'pat-100',
          ashaId: 'asha-200',
          initiatorContext: patientContext,
        });
      }).not.toThrow();

      const ashaContext: UserMessagingContext = {
        userId: 'asha-200',
        role: 'ASHA',
        assignedPatientIds: ['pat-100', 'pat-101'],
      };

      expect(() => {
        RoleBasedMessagingService.validateChannelAuthorization({
          channelType: 'PATIENT_ASHA',
          patientId: 'pat-100',
          ashaId: 'asha-200',
          initiatorContext: ashaContext,
        });
      }).not.toThrow();
    });

    it('1.2 allows PATIENT <-> PHC for registered facility', () => {
      const patientContext: UserMessagingContext = {
        userId: 'pat-100',
        role: 'PATIENT',
      };

      expect(() => {
        RoleBasedMessagingService.validateChannelAuthorization({
          channelType: 'PATIENT_PHC',
          patientId: 'pat-100',
          phcFacilityId: 'fac-phc-karjat',
          initiatorContext: patientContext,
        });
      }).not.toThrow();

      const phcDoctorContext: UserMessagingContext = {
        userId: 'doc-300',
        role: 'PHC',
        facilityId: 'fac-phc-karjat',
      };

      expect(() => {
        RoleBasedMessagingService.validateChannelAuthorization({
          channelType: 'PATIENT_PHC',
          patientId: 'pat-100',
          phcFacilityId: 'fac-phc-karjat',
          initiatorContext: phcDoctorContext,
        });
      }).not.toThrow();
    });

    it('1.3 allows ASHA <-> PHC only for authorized patient healthcare coordination', () => {
      const ashaContext: UserMessagingContext = {
        userId: 'asha-200',
        role: 'ASHA',
        assignedPatientIds: ['pat-100'],
      };

      expect(() => {
        RoleBasedMessagingService.validateChannelAuthorization({
          channelType: 'ASHA_PHC',
          patientId: 'pat-100',
          ashaId: 'asha-200',
          phcFacilityId: 'fac-phc-karjat',
          initiatorContext: ashaContext,
        });
      }).not.toThrow();
    });

    it('1.4 allows PHC <-> DISTRICT_HOSPITAL when active referral relationship exists', () => {
      const phcContext: UserMessagingContext = {
        userId: 'doc-300',
        role: 'PHC',
        facilityId: 'fac-phc-karjat',
      };

      expect(() => {
        RoleBasedMessagingService.validateChannelAuthorization({
          channelType: 'PHC_DISTRICT_HOSPITAL',
          patientId: 'pat-100',
          phcFacilityId: 'fac-phc-karjat',
          dhFacilityId: 'fac-dh-raigad',
          referralId: 'ref-500',
          initiatorContext: phcContext,
        });
      }).not.toThrow();
    });

    it('1.5 allows DISTRICT_HOSPITAL <-> PATIENT for active care episode', () => {
      const specialistContext: UserMessagingContext = {
        userId: 'spec-400',
        role: 'DISTRICT_HOSPITAL',
        facilityId: 'fac-dh-raigad',
      };

      expect(() => {
        RoleBasedMessagingService.validateChannelAuthorization({
          channelType: 'DISTRICT_HOSPITAL_PATIENT',
          patientId: 'pat-100',
          dhFacilityId: 'fac-dh-raigad',
          referralId: 'ref-500',
          initiatorContext: specialistContext,
        });
      }).not.toThrow();
    });
  });

  describe('2. Forbidden Communications & Negative Security Tests', () => {
    it('2.1 rejects patient attempting to access another patient conversation', () => {
      const patientA: UserMessagingContext = {
        userId: 'pat-A',
        role: 'PATIENT',
      };

      expect(() => {
        RoleBasedMessagingService.validateChannelAuthorization({
          channelType: 'PATIENT_ASHA',
          patientId: 'pat-B', // Impersonation attempt
          ashaId: 'asha-200',
          initiatorContext: patientA,
        });
      }).toThrow(/SECURITY_ERROR/);
    });

    it('2.2 rejects ASHA attempting to message unassigned patient', () => {
      const ashaContext: UserMessagingContext = {
        userId: 'asha-200',
        role: 'ASHA',
        assignedPatientIds: ['pat-100', 'pat-101'], // pat-999 is unassigned
      };

      expect(() => {
        RoleBasedMessagingService.validateChannelAuthorization({
          channelType: 'PATIENT_ASHA',
          patientId: 'pat-999',
          ashaId: 'asha-200',
          initiatorContext: ashaContext,
        });
      }).toThrow(/SECURITY_ERROR/);
    });

    it('2.3 rejects PHC doctor attempting to message District Hospital without an active referral', () => {
      const phcContext: UserMessagingContext = {
        userId: 'doc-300',
        role: 'PHC',
        facilityId: 'fac-phc-karjat',
      };

      expect(() => {
        RoleBasedMessagingService.validateChannelAuthorization({
          channelType: 'PHC_DISTRICT_HOSPITAL',
          patientId: 'pat-100',
          phcFacilityId: 'fac-phc-karjat',
          dhFacilityId: 'fac-dh-raigad',
          referralId: undefined, // Missing referral
          initiatorContext: phcContext,
        });
      }).toThrow(/SECURITY_ERROR/);
    });

    it('2.4 rejects cross-facility access (PHC A doctor trying to access PHC B facility conversation)', () => {
      const phcDoctorA: UserMessagingContext = {
        userId: 'doc-karjat',
        role: 'PHC',
        facilityId: 'fac-phc-karjat',
      };

      const convPhcB: ConversationRecord = {
        id: 'conv-phc-pune',
        channel_type: 'PATIENT_PHC',
        patient_id: 'pat-pune',
        phc_facility_id: 'fac-phc-pune', // Different PHC
        created_at: new Date().toISOString(),
      };

      const isAuthorized = RoleBasedMessagingService.isUserAuthorizedForConversation(convPhcB, phcDoctorA);
      expect(isAuthorized).toBe(false);
    });

    it('2.5 rejects District Hospital A specialist accessing District Hospital B referrals', () => {
      const specialistA: UserMessagingContext = {
        userId: 'spec-raigad',
        role: 'DISTRICT_HOSPITAL',
        facilityId: 'fac-dh-raigad',
      };

      const convDhB: ConversationRecord = {
        id: 'conv-dh-thane',
        channel_type: 'PHC_DISTRICT_HOSPITAL',
        patient_id: 'pat-thane',
        phc_facility_id: 'fac-phc-thane-rural',
        dh_facility_id: 'fac-dh-thane', // Different DH
        referral_id: 'ref-thane-1',
        created_at: new Date().toISOString(),
      };

      const isAuthorized = RoleBasedMessagingService.isUserAuthorizedForConversation(convDhB, specialistA);
      expect(isAuthorized).toBe(false);
    });

    it('2.6 rejects access simply by guessing a conversationId', async () => {
      const unauthorizedPatient: UserMessagingContext = {
        userId: 'pat-intruder',
        role: 'PATIENT',
      };

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'conv-private-123',
                    channel_type: 'PATIENT_ASHA',
                    patient_id: 'pat-victim', // Belong to another patient
                    asha_id: 'asha-sunita',
                  },
                  error: null,
                }),
            }),
          }),
        } as any;
      });

      await expect(
        RoleBasedMessagingService.getMessages('conv-private-123', unauthorizedPatient)
      ).rejects.toThrow(/SECURITY_ERROR/);
    });
  });

  describe('3. Sending Messages & Targeted Realtime Broadcasting', () => {
    it('3.1 saves message and broadcasts only to the authorized recipient (PATIENT -> ASHA)', async () => {
      const conv: ConversationRecord = {
        id: 'conv-pat-asha-1',
        channel_type: 'PATIENT_ASHA',
        patient_id: 'pat-100',
        asha_id: 'asha-200',
        created_at: new Date().toISOString(),
      };

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: conv, error: null }),
              }),
            }),
            update: () => ({
              eq: () => Promise.resolve({ data: {}, error: null }),
            }),
          } as any;
        }
        if (table === 'messages') {
          return {
            insert: (data: any) => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'msg-999',
                      ...data,
                    },
                    error: null,
                  }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      let publishedEvent: any = null;
      vi.spyOn(RealtimeCommunicationService, 'publishEvent').mockImplementation(async (p: any) => {
        publishedEvent = p;
        return { id: 'evt-msg-1', ...p, timestamp: new Date().toISOString() };
      });

      const res = await RoleBasedMessagingService.sendMessage({
        conversationId: 'conv-pat-asha-1',
        senderContext: { userId: 'pat-100', role: 'PATIENT' },
        message: 'Hello ASHA didi, I need advice regarding my BP prescription.',
      });

      expect(res.message.id).toBe('msg-999');
      expect(res.message.message).toBe('Hello ASHA didi, I need advice regarding my BP prescription.');
      expect(publishedEvent.type).toBe('NEW_MESSAGE');
      expect(publishedEvent.actorRole).toBe('PATIENT');
      expect(publishedEvent.recipientType).toBe('ASHA');
      expect(publishedEvent.recipientUserId).toBe('asha-200');
    });
  });
});
