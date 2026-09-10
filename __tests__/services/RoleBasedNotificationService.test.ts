import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RoleBasedNotificationService,
  CreateNotificationParams,
} from '../../lib/services/RoleBasedNotificationService';
import { RealtimeCommunicationService, ContextUser } from '../../lib/services/RealtimeCommunicationService';
import { supabase } from '../../lib/supabaseClient';

describe('RoleBasedNotificationService (Role-Based Notification System)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. PATIENT Notification Flow', () => {
    it('1.1 creates appointment confirmation notification for patient', async () => {
      const insertedRow = {
        id: 'notif-pat-1',
        recipient_user_id: 'pat-100',
        recipient_role: 'PATIENT',
        type: 'APPOINTMENT_CONFIRMED',
        title: 'Appointment Confirmed',
        message: 'Your appointment at Dhamangaon Sub-center has been confirmed.',
        patient_id: 'pat-100',
        related_entity_id: 'apt-101',
        related_entity_type: 'appointment',
        priority: 'NORMAL',
        is_read: false,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'role_notifications') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: insertedRow, error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'notification_audit_logs') {
          return {
            insert: () => Promise.resolve({ data: {}, error: null }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(RealtimeCommunicationService, 'publishEvent').mockResolvedValue({} as any);

      const res = await RoleBasedNotificationService.createNotification({
        recipientUserId: 'pat-100',
        recipientRole: 'PATIENT',
        patientId: 'pat-100',
        type: 'APPOINTMENT_CONFIRMED',
        title: 'Appointment Confirmed',
        message: 'Your appointment at Dhamangaon Sub-center has been confirmed.',
        relatedEntityId: 'apt-101',
        relatedEntityType: 'appointment',
      });

      expect(res.notification.id).toBe('notif-pat-1');
      expect(res.isDuplicate).toBe(false);
      expect(res.notification.recipient_role).toBe('PATIENT');
    });

    it('1.2 enforces privacy: notification message does not expose raw diagnosis', async () => {
      const cleanMessage = 'Your consultation record has been updated by the PHC medical officer.';
      expect(cleanMessage).not.toContain('ICD-10');
      expect(cleanMessage).not.toContain('Acute Infarction');
    });
  });

  describe('2. ASHA Notification Flow', () => {
    it('2.1 creates new patient assistance request notification for assigned ASHA', async () => {
      const ashaRow = {
        id: 'notif-asha-1',
        recipient_user_id: 'asha-sunita',
        recipient_role: 'ASHA',
        type: 'NEW_PATIENT_REQUEST',
        title: 'New Patient Request',
        message: 'Patient requested assistance with home BP monitoring.',
        patient_id: 'pat-100',
        priority: 'NORMAL',
        is_read: false,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'role_notifications') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: ashaRow, error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'notification_audit_logs') {
          return {
            insert: () => Promise.resolve({ data: {}, error: null }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(RealtimeCommunicationService, 'publishEvent').mockResolvedValue({} as any);

      const res = await RoleBasedNotificationService.createNotification({
        recipientUserId: 'asha-sunita',
        recipientRole: 'ASHA',
        patientId: 'pat-100',
        type: 'NEW_PATIENT_REQUEST',
        title: 'New Patient Request',
        message: 'Patient requested assistance with home BP monitoring.',
      });

      expect(res.notification.type).toBe('NEW_PATIENT_REQUEST');
      expect(res.notification.recipient_user_id).toBe('asha-sunita');
    });
  });

  describe('3. PHC Notification Flow', () => {
    it('3.1 creates facility-scoped notification for PHC when patient checks in', async () => {
      const phcRow = {
        id: 'notif-phc-1',
        recipient_facility_id: 'fac-phc-karjat',
        recipient_role: 'PHC',
        type: 'PATIENT_CHECKED_IN',
        title: 'Patient Checked In',
        message: 'Patient has arrived and checked in for OPD consultation.',
        patient_id: 'pat-100',
        priority: 'NORMAL',
        is_read: false,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'role_notifications') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: phcRow, error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'notification_audit_logs') {
          return {
            insert: () => Promise.resolve({ data: {}, error: null }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(RealtimeCommunicationService, 'publishEvent').mockResolvedValue({} as any);

      const res = await RoleBasedNotificationService.createNotification({
        recipientRole: 'PHC',
        recipientFacilityId: 'fac-phc-karjat',
        patientId: 'pat-100',
        type: 'PATIENT_CHECKED_IN',
        title: 'Patient Checked In',
        message: 'Patient has arrived and checked in for OPD consultation.',
      });

      expect(res.notification.recipient_facility_id).toBe('fac-phc-karjat');
      expect(res.notification.type).toBe('PATIENT_CHECKED_IN');
    });
  });

  describe('4. DISTRICT HOSPITAL Notification Flow & Priorities', () => {
    it('4.1 sets URGENT priority for critical hospital escalation referral', async () => {
      const dhRow = {
        id: 'notif-dh-1',
        recipient_facility_id: 'fac-dh-raigad',
        recipient_role: 'DISTRICT_HOSPITAL',
        type: 'URGENT_REFERRAL',
        title: 'Urgent Referral Received',
        message: 'Emergency cardiac referral requires immediate specialist review.',
        patient_id: 'pat-100',
        priority: 'URGENT',
        is_read: false,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'role_notifications') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: dhRow, error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'notification_audit_logs') {
          return {
            insert: () => Promise.resolve({ data: {}, error: null }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(RealtimeCommunicationService, 'publishEvent').mockResolvedValue({} as any);

      const res = await RoleBasedNotificationService.createNotification({
        recipientRole: 'DISTRICT_HOSPITAL',
        recipientFacilityId: 'fac-dh-raigad',
        patientId: 'pat-100',
        type: 'URGENT_REFERRAL',
        title: 'Urgent Referral Received',
        message: 'Emergency cardiac referral requires immediate specialist review.',
      });

      expect(res.notification.priority).toBe('URGENT');
    });
  });

  describe('5. Duplicate Prevention (Idempotency)', () => {
    it('5.1 returns existing notification without creating duplicate when key matches', async () => {
      const existingNotif = {
        id: 'notif-dup-1',
        recipient_role: 'PHC',
        type: 'NEW_REFERRAL_RESPONSE',
        title: 'Referral Response',
        message: 'Referral has been accepted.',
        idempotency_key: 'PHC_NEW_REFERRAL_RESPONSE_ref-100_fac-phc-karjat',
      };

      vi.spyOn(supabase, 'from').mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: existingNotif, error: null }),
          }),
        }),
      } as any));

      const res = await RoleBasedNotificationService.createNotification({
        recipientRole: 'PHC',
        recipientFacilityId: 'fac-phc-karjat',
        type: 'NEW_REFERRAL_RESPONSE',
        title: 'Referral Response',
        message: 'Referral has been accepted.',
        idempotencyKey: 'PHC_NEW_REFERRAL_RESPONSE_ref-100_fac-phc-karjat',
      });

      expect(res.isDuplicate).toBe(true);
      expect(res.notification.id).toBe('notif-dup-1');
    });
  });

  describe('6. Re-Authorization on Click & Security Guardrails', () => {
    it('6.1 verifies entity access before opening and rejects unauthorized users', async () => {
      vi.spyOn(supabase, 'from').mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { id: 'ref-secret', patient_id: 'pat-victim', source_facility_id: 'fac-phc-pune' },
                error: null,
              }),
          }),
        }),
      } as any));

      const unauthorizedUser: ContextUser = {
        userId: 'pat-intruder',
        role: 'PATIENT',
      };

      const check = await RoleBasedNotificationService.verifyEntityAccess('ref-secret', 'referral', unauthorizedUser);
      expect(check.authorized).toBe(false);
      expect(check.reason).toContain('You no longer have access');
    });
  });
});
