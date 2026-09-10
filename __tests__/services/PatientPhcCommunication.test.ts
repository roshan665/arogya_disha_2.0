import {
  PatientPhcCommunicationService,
  PhcAppointmentStatus,
} from '../../lib/services/PatientPhcCommunicationService';
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

describe('PatientPhcCommunicationService & Security Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. PATIENT -> PHC: Appointment Request', () => {
    it('creates appointment request and dispatches APPOINTMENT_REQUESTED to target PHC facility', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'apt-1',
                patient_id: 'pat-roshan',
                facility_id: 'fac-phc-karjat',
                status: 'REQUESTED',
                consult_type: 'General OPD',
                preferred_date: '2026-05-18',
                preferred_time_slot: '10:00 AM',
              },
              error: null,
            }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });
      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: 'evt-apt-1',
        type: 'APPOINTMENT_REQUESTED',
      });

      const result = await PatientPhcCommunicationService.requestPhcAppointment({
        patientId: 'pat-roshan',
        phcFacilityId: 'fac-phc-karjat',
        consultType: 'General OPD',
        preferredDate: '2026-05-18',
        preferredTimeSlot: '10:00 AM',
      });

      expect(result.appointment.id).toBe('apt-1');
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: 'APPOINTMENT_REQUESTED',
        actorId: 'pat-roshan',
        actorRole: 'PATIENT',
        patientId: 'pat-roshan',
        relatedEntityId: 'apt-1',
        relatedEntityType: 'appointment',
        recipientType: 'PHC',
        recipientFacilityId: 'fac-phc-karjat',
      });
    });

    it('throws validation error if required booking parameters are missing', async () => {
      await expect(
        PatientPhcCommunicationService.requestPhcAppointment({
          patientId: '',
          phcFacilityId: 'fac-phc-karjat',
          consultType: 'General OPD',
          preferredDate: '',
          preferredTimeSlot: '10:00 AM',
        })
      ).rejects.toThrow('VALIDATION_ERROR');
    });
  });

  describe('2. PHC -> PATIENT: Appointment Status Lifecycle', () => {
    const statuses: PhcAppointmentStatus[] = [
      'REQUESTED',
      'CONFIRMED',
      'RESCHEDULED',
      'CANCELLED',
      'CHECKED_IN',
      'COMPLETED',
      'NO_SHOW',
    ];

    it.each(statuses)('updates status to %s and notifies patient in real time', async (status) => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'apt-1',
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
        type: `APPOINTMENT_${status}`,
      });

      const result = await PatientPhcCommunicationService.updateAppointmentStatus({
        appointmentId: 'apt-1',
        patientId: 'pat-roshan',
        phcFacilityId: 'fac-phc-karjat',
        doctorId: 'u-doc-101',
        status,
      });

      expect(result.updated.status).toBe(status);
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: `APPOINTMENT_${status}`,
        actorId: 'u-doc-101',
        actorRole: 'PHC',
        patientId: 'pat-roshan',
        relatedEntityId: 'apt-1',
        relatedEntityType: 'appointment',
        recipientType: 'PATIENT',
        recipientUserId: 'pat-roshan',
      });
    });
  });

  describe('3. PATIENT -> PHC: Check-In', () => {
    it('records check-in and dispatches PATIENT_CHECKED_IN event to PHC OPD queue', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'apt-1',
                  status: 'CHECKED_IN',
                  check_in_time: '2026-05-18T10:00:00Z',
                },
                error: null,
              }),
          }),
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });
      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: 'evt-checkin-1',
        type: 'PATIENT_CHECKED_IN',
      });

      const result = await PatientPhcCommunicationService.checkInPatient({
        appointmentId: 'apt-1',
        patientId: 'pat-roshan',
        phcFacilityId: 'fac-phc-karjat',
      });

      expect(result.updated.status).toBe('CHECKED_IN');
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: 'PATIENT_CHECKED_IN',
        actorId: 'pat-roshan',
        actorRole: 'PATIENT',
        patientId: 'pat-roshan',
        relatedEntityId: 'apt-1',
        relatedEntityType: 'appointment',
        recipientType: 'PHC',
        recipientFacilityId: 'fac-phc-karjat',
      });
    });
  });

  describe('4. PHC -> PATIENT: Consultation Completion & Privacy', () => {
    it('completes consultation and notifies patient without leaking internal clinical notes', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'con-1',
                appointment_id: 'apt-1',
                patient_id: 'pat-roshan',
                facility_id: 'fac-phc-karjat',
                doctor_id: 'u-doc-101',
                public_summary: 'Consultation completed. Take medications as prescribed and review in 5 days.',
                internal_clinical_notes: 'CONFIDENTIAL: Suspected acute bronchitis. Rx Azithromycin 500mg OD x 3d, Paracetamol 650mg TDS.',
              },
              error: null,
            }),
        }),
      });
      const mockUpdate = jest.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'phc_consultations') return { insert: mockInsert };
        if (table === 'phc_appointments') return { update: mockUpdate };
        return {};
      });

      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: 'evt-con-1',
        type: 'CONSULTATION_COMPLETED',
      });

      const result = await PatientPhcCommunicationService.completeConsultation({
        appointmentId: 'apt-1',
        patientId: 'pat-roshan',
        phcFacilityId: 'fac-phc-karjat',
        doctorId: 'u-doc-101',
        publicSummary: 'Consultation completed. Take medications as prescribed and review in 5 days.',
        internalClinicalNotes: 'CONFIDENTIAL: Suspected acute bronchitis. Rx Azithromycin 500mg OD x 3d, Paracetamol 650mg TDS.',
      });

      expect(result.consultation.id).toBe('con-1');
      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: 'CONSULTATION_COMPLETED',
        actorId: 'u-doc-101',
        actorRole: 'PHC',
        patientId: 'pat-roshan',
        relatedEntityId: 'con-1',
        relatedEntityType: 'consultation',
        recipientType: 'PATIENT',
        recipientUserId: 'pat-roshan',
      });
    });
  });

  describe('5. DIAGNOSTIC REPORTS: PHC & PATIENT Realtime Notifications', () => {
    it('notifies both PHC and Patient with minimal payload and zero leaked clinical values', async () => {
      (RealtimeCommunicationService.publishEvent as jest.Mock).mockResolvedValue({
        id: 'evt-rep-1',
      });

      const result = await PatientPhcCommunicationService.notifyDiagnosticReportAvailable({
        reportId: 'rep-101',
        patientId: 'pat-roshan',
        phcFacilityId: 'fac-phc-karjat',
        testType: 'Complete Blood Count',
        reportTitle: 'CBC Report (Normal Hb)',
      });

      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: 'DIAGNOSTIC_REPORT_AVAILABLE',
        actorId: 'fac-phc-karjat',
        actorRole: 'PHC',
        patientId: 'pat-roshan',
        relatedEntityId: 'rep-101',
        relatedEntityType: 'diagnostic',
        recipientType: 'PHC',
        recipientFacilityId: 'fac-phc-karjat',
      });

      expect(RealtimeCommunicationService.publishEvent).toHaveBeenCalledWith({
        type: 'REPORT_AVAILABLE',
        actorId: 'fac-phc-karjat',
        actorRole: 'PHC',
        patientId: 'pat-roshan',
        relatedEntityId: 'rep-101',
        relatedEntityType: 'diagnostic',
        recipientType: 'PATIENT',
        recipientUserId: 'pat-roshan',
      });
    });
  });
});
