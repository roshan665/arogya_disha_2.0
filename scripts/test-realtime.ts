import assert from 'node:assert';
import {
  RealtimeCommunicationService,
  RealtimeEventAuthorizer,
  RealtimeHealthcareEvent,
  ContextUser,
} from '../lib/services/RealtimeCommunicationService';
import { PatientAshaCommunicationService } from '../lib/services/PatientAshaCommunicationService';
import {
  PatientPhcCommunicationService,
  PhcAppointmentStatus,
} from '../lib/services/PatientPhcCommunicationService';
import {
  PhcDistrictHospitalCommunicationService,
  HospitalReferralStatus,
} from '../lib/services/PhcDistrictHospitalCommunicationService';
import { HealthcareJourneyLoopService } from '../lib/services/HealthcareJourneyLoopService';
import {
  RoleBasedMessagingService,
  UserMessagingContext,
  ConversationRecord,
} from '../lib/services/RoleBasedMessagingService';
import {
  RoleBasedNotificationService,
  UserNotificationContext,
  RoleNotification,
} from '../lib/services/RoleBasedNotificationService';
import { OnboardingProfileService } from '../lib/services/OnboardingProfileService';
import { supabase } from '../lib/supabaseClient';

async function runTests() {
  console.log('=== Starting ArogyaDisha Realtime Communication & Security Tests ===\n');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      failed++;
    }
  }

  console.log('--- 1. Security & Payload Sanitization ---');

  await test('1.1 strips all sensitive medical records from realtime event payload', () => {
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
    assert.strictEqual((sanitized as any).diagnosis, undefined);
    assert.strictEqual((sanitized as any).prescription, undefined);
    assert.strictEqual((sanitized as any).vitals, undefined);
    assert.strictEqual((sanitized as any).clinical_notes, undefined);
    assert.strictEqual(sanitized.type, 'REFERRAL_CREATED');
    assert.strictEqual(sanitized.patientId, 'pat-456');
  });

  await test('1.2 rejects invalid roles outside the 4 core roles (PATIENT, ASHA, PHC, DISTRICT_HOSPITAL)', () => {
    assert.throws(() => {
      RealtimeCommunicationService.sanitizeEventPayload({
        type: 'TEST_EVENT',
        actorId: 'user-1',
        actorRole: 'SUPER_ADMIN_INVALID' as any,
        patientId: 'pat-1',
        relatedEntityId: 'ent-1',
        relatedEntityType: 'appointment',
        recipientType: 'PATIENT',
      });
    }, /VALIDATION_ERROR/);
  });

  console.log('\n--- 2. Five-Question Authorization Engine & Isolation Tests ---');

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

  await test('2.1 PATIENT scope: Patient A cannot receive events intended for Patient B', () => {
    const patientEvent: RealtimeHealthcareEvent = {
      ...baseEvent,
      recipientType: 'PATIENT',
      patientId: 'pat-roshan',
      recipientUserId: 'pat-roshan',
    };

    const authorizedPatient: ContextUser = { userId: 'pat-roshan', role: 'PATIENT' };
    const unauthorizedPatient: ContextUser = { userId: 'pat-other-user', role: 'PATIENT' };

    assert.strictEqual(RealtimeEventAuthorizer.isAuthorizedRecipient(patientEvent, authorizedPatient), true);
    assert.strictEqual(RealtimeEventAuthorizer.isAuthorizedRecipient(patientEvent, unauthorizedPatient), false);
  });

  await test('2.2 ASHA scope: ASHA cannot receive events for unassigned patients', () => {
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

    assert.strictEqual(RealtimeEventAuthorizer.isAuthorizedRecipient(ashaEvent, assignedAsha), true);
    assert.strictEqual(RealtimeEventAuthorizer.isAuthorizedRecipient(ashaEvent, unassignedAsha), false);
  });

  await test('2.3 PHC scope: PHC A doctor must not receive PHC B facility patient events', () => {
    const phcEvent: RealtimeHealthcareEvent = {
      ...baseEvent,
      recipientType: 'PHC',
      patientId: 'pat-phc-care',
      recipientFacilityId: 'fac-phc-karjat',
    };

    const phcDoctorA: ContextUser = { userId: 'doc-amit', role: 'PHC', facilityId: 'fac-phc-karjat' };
    const phcDoctorB: ContextUser = { userId: 'doc-pune', role: 'PHC', facilityId: 'fac-phc-pune' };

    assert.strictEqual(RealtimeEventAuthorizer.isAuthorizedRecipient(phcEvent, phcDoctorA), true);
    assert.strictEqual(RealtimeEventAuthorizer.isAuthorizedRecipient(phcEvent, phcDoctorB), false);
  });

  await test('2.4 DISTRICT_HOSPITAL scope: District Hospital A must not receive District Hospital B referrals', () => {
    const dhEvent: RealtimeHealthcareEvent = {
      ...baseEvent,
      recipientType: 'DISTRICT_HOSPITAL',
      patientId: 'pat-referred',
      recipientFacilityId: 'fac-dh-raigad',
    };

    const dhStaffRaigad: ContextUser = { userId: 'dh-doc-raigad', role: 'DISTRICT_HOSPITAL', facilityId: 'fac-dh-raigad' };
    const dhStaffThane: ContextUser = { userId: 'dh-doc-thane', role: 'DISTRICT_HOSPITAL', facilityId: 'fac-dh-thane' };

    assert.strictEqual(RealtimeEventAuthorizer.isAuthorizedRecipient(dhEvent, dhStaffRaigad), true);
    assert.strictEqual(RealtimeEventAuthorizer.isAuthorizedRecipient(dhEvent, dhStaffThane), false);
  });

  console.log('\n--- 3. PATIENT <-> ASHA Workflow Tests ---');

  await test('3.1 PATIENT -> ASHA request creates assistance request and NEW_PATIENT_REQUEST event', async () => {
    (supabase as any).from = (table: string) => ({
      insert: (data: any) => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'req-1',
                ...data,
              },
              error: null,
            }),
        }),
      }),
    });

    let publishedEvent: any = null;
    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      publishedEvent = p;
      return { id: 'evt-req-1', ...p, timestamp: new Date().toISOString() };
    };

    const result = await PatientAshaCommunicationService.requestAshaAssistance({
      patientId: 'pat-roshan',
      ashaId: 'asha-sunita',
      requestType: 'HOME_VISIT',
      message: 'Need help with blood pressure checkup',
    });

    assert.strictEqual(result.request.id, 'req-1');
    assert.strictEqual(publishedEvent.type, 'NEW_PATIENT_REQUEST');
    assert.strictEqual(publishedEvent.recipientType, 'ASHA');
    assert.strictEqual(publishedEvent.recipientUserId, 'asha-sunita');

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  await test('3.2 ASHA -> PATIENT status update dispatches REQUEST_ACCEPTED to patient', async () => {
    (supabase as any).from = (table: string) => ({
      update: (data: any) => ({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'req-1',
                  status: data.status,
                },
                error: null,
              }),
          }),
        }),
      }),
    });

    let publishedEvent: any = null;
    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      publishedEvent = p;
      return { id: 'evt-status-1', ...p, timestamp: new Date().toISOString() };
    };

    const result = await PatientAshaCommunicationService.updateAssistanceRequestStatus({
      requestId: 'req-1',
      patientId: 'pat-roshan',
      ashaId: 'asha-sunita',
      status: 'ACCEPTED',
    });

    assert.strictEqual(result.updated.status, 'ACCEPTED');
    assert.strictEqual(publishedEvent.type, 'REQUEST_ACCEPTED');
    assert.strictEqual(publishedEvent.recipientType, 'PATIENT');

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  await test('3.3 ASHA Follow-up protects internal clinical notes & escalates to PHC', async () => {
    let publishedEvents: any[] = [];
    (supabase as any).from = (table: string) => ({
      insert: (data: any) => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'fu-esc-99',
                ...data,
              },
              error: null,
            }),
        }),
      }),
    });

    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      publishedEvents.push(p);
      return { id: `evt-${publishedEvents.length}`, ...p, timestamp: new Date().toISOString() };
    };

    const result = await PatientAshaCommunicationService.recordAshaFollowUp({
      patientId: 'pat-roshan',
      ashaId: 'asha-sunita',
      followUpType: 'patient_needs_phc_consultation',
      publicPatientUpdate: 'Doctor consultation request initiated at PHC.',
      internalAshaNotes: 'CONFIDENTIAL: High systolic BP 160/100, edema in feet, needs immediate physician assessment.',
      escalateToPhc: true,
      phcFacilityId: 'fac-phc-karjat',
    });

    assert.strictEqual(result.followUp.id, 'fu-esc-99');
    assert.strictEqual(publishedEvents.length, 2);

    const patientEvt = publishedEvents.find((e) => e.recipientType === 'PATIENT');
    assert.ok(patientEvt);
    assert.strictEqual(patientEvt.type, 'ASHA_FOLLOWUP_RECORDED');
    assert.strictEqual((patientEvt as any).internalAshaNotes, undefined);

    const phcEvt = publishedEvents.find((e) => e.recipientType === 'PHC');
    assert.ok(phcEvt);
    assert.strictEqual(phcEvt.type, 'PHC_FOLLOWUP_REQUEST');
    assert.strictEqual(phcEvt.recipientFacilityId, 'fac-phc-karjat');

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  console.log('\n--- 4. PATIENT <-> PHC Workflow Tests ---');

  await test('4.1 PATIENT -> PHC: Appointment Request creates record & APPOINTMENT_REQUESTED event', async () => {
    let publishedEvent: any = null;
    (supabase as any).from = (table: string) => ({
      insert: (data: any) => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'apt-phc-101',
                ...data,
              },
              error: null,
            }),
        }),
      }),
    });

    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      publishedEvent = p;
      return { id: 'evt-apt-1', ...p, timestamp: new Date().toISOString() };
    };

    const result = await PatientPhcCommunicationService.requestPhcAppointment({
      patientId: 'pat-roshan',
      phcFacilityId: 'fac-phc-karjat',
      consultType: 'General OPD',
      preferredDate: '2026-05-18',
      preferredTimeSlot: '10:00 AM',
    });

    assert.strictEqual(result.appointment.id, 'apt-phc-101');
    assert.strictEqual(publishedEvent.type, 'APPOINTMENT_REQUESTED');
    assert.strictEqual(publishedEvent.recipientType, 'PHC');
    assert.strictEqual(publishedEvent.recipientFacilityId, 'fac-phc-karjat');

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  await test('4.2 PHC -> PATIENT: Appointment status lifecycle (CONFIRMED, RESCHEDULED, CANCELLED, NO_SHOW)', async () => {
    const statuses: PhcAppointmentStatus[] = ['CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'];
    const origPublish = RealtimeCommunicationService.publishEvent;

    for (const status of statuses) {
      let publishedEvent: any = null;
      (supabase as any).from = (table: string) => ({
        update: (data: any) => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'apt-phc-101',
                    status: data.status,
                  },
                  error: null,
                }),
            }),
          }),
        }),
      });

      RealtimeCommunicationService.publishEvent = async (p: any) => {
        publishedEvent = p;
        return { id: `evt-${status}`, ...p, timestamp: new Date().toISOString() };
      };

      const result = await PatientPhcCommunicationService.updateAppointmentStatus({
        appointmentId: 'apt-phc-101',
        patientId: 'pat-roshan',
        phcFacilityId: 'fac-phc-karjat',
        doctorId: 'u-doc-101',
        status,
      });

      assert.strictEqual(result.updated.status, status);
      assert.strictEqual(publishedEvent.type, `APPOINTMENT_${status}`);
      assert.strictEqual(publishedEvent.recipientType, 'PATIENT');
      assert.strictEqual(publishedEvent.recipientUserId, 'pat-roshan');
    }

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  await test('4.3 PATIENT -> PHC: Patient Check-In dispatches PATIENT_CHECKED_IN to PHC queue', async () => {
    let publishedEvent: any = null;
    (supabase as any).from = (table: string) => ({
      update: (data: any) => ({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'apt-phc-101',
                  status: 'CHECKED_IN',
                },
                error: null,
              }),
          }),
        }),
      }),
    });

    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      publishedEvent = p;
      return { id: 'evt-checkin', ...p, timestamp: new Date().toISOString() };
    };

    const result = await PatientPhcCommunicationService.checkInPatient({
      appointmentId: 'apt-phc-101',
      patientId: 'pat-roshan',
      phcFacilityId: 'fac-phc-karjat',
    });

    assert.strictEqual(result.updated.status, 'CHECKED_IN');
    assert.strictEqual(publishedEvent.type, 'PATIENT_CHECKED_IN');
    assert.strictEqual(publishedEvent.recipientType, 'PHC');
    assert.strictEqual(publishedEvent.recipientFacilityId, 'fac-phc-karjat');

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  await test('4.4 PHC -> PATIENT: Consultation Completion strictly withholds doctor internal notes', async () => {
    let publishedEvent: any = null;
    (supabase as any).from = (table: string) => {
      if (table === 'phc_consultations') {
        return {
          insert: (data: any) => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'con-phc-101',
                    ...data,
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {
        update: () => ({ eq: () => Promise.resolve({ data: {}, error: null }) }),
      };
    };

    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      publishedEvent = p;
      return { id: 'evt-con-1', ...p, timestamp: new Date().toISOString() };
    };

    const result = await PatientPhcCommunicationService.completeConsultation({
      appointmentId: 'apt-phc-101',
      patientId: 'pat-roshan',
      phcFacilityId: 'fac-phc-karjat',
      doctorId: 'u-doc-101',
      publicSummary: 'OPD Consultation completed. Review after 5 days.',
      internalClinicalNotes: 'CONFIDENTIAL: Suspected acute respiratory tract infection. Antibiotics initiated.',
    });

    assert.strictEqual(result.consultation.id, 'con-phc-101');
    assert.strictEqual(publishedEvent.type, 'CONSULTATION_COMPLETED');
    assert.strictEqual(publishedEvent.recipientType, 'PATIENT');
    assert.strictEqual(publishedEvent.recipientUserId, 'pat-roshan');
    assert.strictEqual((publishedEvent as any).internalClinicalNotes, undefined);

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  await test('4.5 DIAGNOSTIC REPORT: Notifies both PHC & Patient with minimal payload and no raw test values', async () => {
    let publishedEvents: any[] = [];
    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      publishedEvents.push(p);
      return { id: `evt-diag-${publishedEvents.length}`, ...p, timestamp: new Date().toISOString() };
    };

    await PatientPhcCommunicationService.notifyDiagnosticReportAvailable({
      reportId: 'rep-cbc-101',
      patientId: 'pat-roshan',
      phcFacilityId: 'fac-phc-karjat',
      testType: 'Complete Blood Count',
      reportTitle: 'CBC Report (Normal Hb)',
    });

    assert.strictEqual(publishedEvents.length, 2);

    const phcEvent = publishedEvents.find((e) => e.recipientType === 'PHC');
    assert.ok(phcEvent);
    assert.strictEqual(phcEvent.type, 'DIAGNOSTIC_REPORT_AVAILABLE');
    assert.strictEqual(phcEvent.recipientFacilityId, 'fac-phc-karjat');

    const patientEvent = publishedEvents.find((e) => e.recipientType === 'PATIENT');
    assert.ok(patientEvent);
    assert.strictEqual(patientEvent.type, 'REPORT_AVAILABLE');
    assert.strictEqual(patientEvent.recipientUserId, 'pat-roshan');

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  console.log('\n--- 5. PHC <-> DISTRICT_HOSPITAL Escalation Workflow Tests ---');

  await test('5.1 PHC CREATES REFERRAL -> DISTRICT HOSPITAL: creates record & dispatches NEW_REFERRAL event', async () => {
    let publishedEvent: any = null;
    (supabase as any).from = (table: string) => ({
      insert: (data: any) => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'ref-dh-999',
                ...data,
              },
              error: null,
            }),
        }),
      }),
    });

    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      publishedEvent = p;
      return { id: 'evt-ref-999', ...p, timestamp: new Date().toISOString() };
    };

    const result = await PhcDistrictHospitalCommunicationService.createPhcReferral({
      patientId: 'pat-roshan',
      sourceFacilityId: 'fac-phc-karjat',
      destinationFacilityId: 'fac-dh-raigad',
      referringDoctorId: 'u-doc-101',
      priority: 'RED',
      reason: 'Acute Coronary Syndrome',
      clinicalSummary: 'ECG ST Elevation in Lead II, III, aVF.',
    });

    assert.strictEqual(result.referral.id, 'ref-dh-999');
    assert.strictEqual(publishedEvent.type, 'NEW_REFERRAL');
    assert.strictEqual(publishedEvent.actorRole, 'PHC');
    assert.strictEqual(publishedEvent.recipientType, 'DISTRICT_HOSPITAL');
    assert.strictEqual(publishedEvent.recipientFacilityId, 'fac-dh-raigad');

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  await test('5.2 DISTRICT HOSPITAL ACTIONS: DH updates status through full lifecycle & notifies referring PHC', async () => {
    const statuses: HospitalReferralStatus[] = [
      'RECEIVED',
      'UNDER_REVIEW',
      'ACCEPTED',
      'REJECTED',
      'IN_PROGRESS',
      'COMPLETED',
      'RETURNED_TO_PHC',
    ];
    const origPublish = RealtimeCommunicationService.publishEvent;

    for (const status of statuses) {
      let publishedEvent: any = null;
      (supabase as any).from = (table: string) => ({
        update: (data: any) => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'ref-dh-999',
                    status: data.status,
                  },
                  error: null,
                }),
            }),
          }),
        }),
      });

      RealtimeCommunicationService.publishEvent = async (p: any) => {
        publishedEvent = p;
        return { id: `evt-${status}`, ...p, timestamp: new Date().toISOString() };
      };

      const result = await PhcDistrictHospitalCommunicationService.updateReferralStatus({
        referralId: 'ref-dh-999',
        patientId: 'pat-roshan',
        sourceFacilityId: 'fac-phc-karjat',
        destinationFacilityId: 'fac-dh-raigad',
        specialistId: 'u-dh-spec-1',
        status,
      });

      assert.strictEqual(result.updated.status, status);
      assert.strictEqual(publishedEvent.type, `REFERRAL_${status}`);
      assert.strictEqual(publishedEvent.recipientType, 'PHC');
      assert.strictEqual(publishedEvent.recipientFacilityId, 'fac-phc-karjat');
    }

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  await test('5.3 APPOINTMENT SCHEDULED: Fans out realtime event to PHC AND Patient', async () => {
    let publishedEvents: any[] = [];
    (supabase as any).from = (table: string) => ({
      update: (data: any) => ({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'ref-dh-999',
                  status: 'APPOINTMENT_SCHEDULED',
                  scheduled_appointment_date: '2026-05-20',
                },
                error: null,
              }),
          }),
        }),
      }),
    });

    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      publishedEvents.push(p);
      return { id: `evt-apt-${publishedEvents.length}`, ...p, timestamp: new Date().toISOString() };
    };

    const result = await PhcDistrictHospitalCommunicationService.updateReferralStatus({
      referralId: 'ref-dh-999',
      patientId: 'pat-roshan',
      sourceFacilityId: 'fac-phc-karjat',
      destinationFacilityId: 'fac-dh-raigad',
      specialistId: 'u-dh-spec-1',
      status: 'APPOINTMENT_SCHEDULED',
      scheduledDate: '2026-05-20',
      scheduledTime: '10:30 AM',
    });

    assert.strictEqual(result.updated.status, 'APPOINTMENT_SCHEDULED');
    assert.strictEqual(publishedEvents.length, 2);

    const phcEvt = publishedEvents.find((e) => e.recipientType === 'PHC');
    assert.ok(phcEvt);
    assert.strictEqual(phcEvt.type, 'REFERRAL_APPOINTMENT_SCHEDULED');

    const patEvt = publishedEvents.find((e) => e.recipientType === 'PATIENT');
    assert.ok(patEvt);
    assert.strictEqual(patEvt.type, 'APPOINTMENT_SCHEDULED');

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  await test('5.4 ADDITIONAL INFORMATION: Loop between DH and PHC', async () => {
    let publishedEvents: any[] = [];
    (supabase as any).from = (table: string) => ({
      update: (data: any) => ({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: 'ref-dh-999',
                  status: data.status,
                },
                error: null,
              }),
          }),
        }),
      }),
    });

    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      publishedEvents.push(p);
      return { id: `evt-info-${publishedEvents.length}`, ...p, timestamp: new Date().toISOString() };
    };

    // Step 1: DH requests info -> PHC
    await PhcDistrictHospitalCommunicationService.requestAdditionalInformation({
      referralId: 'ref-dh-999',
      patientId: 'pat-roshan',
      sourceFacilityId: 'fac-phc-karjat',
      destinationFacilityId: 'fac-dh-raigad',
      specialistId: 'u-dh-spec-1',
      informationRequested: 'Need echocardiogram report.',
    });

    assert.strictEqual(publishedEvents[0].type, 'ADDITIONAL_INFORMATION_REQUIRED');
    assert.strictEqual(publishedEvents[0].recipientType, 'PHC');
    assert.strictEqual(publishedEvents[0].recipientFacilityId, 'fac-phc-karjat');

    // Step 2: PHC submits info -> DH
    await PhcDistrictHospitalCommunicationService.submitAdditionalInformation({
      referralId: 'ref-dh-999',
      patientId: 'pat-roshan',
      sourceFacilityId: 'fac-phc-karjat',
      destinationFacilityId: 'fac-dh-raigad',
      doctorId: 'u-doc-101',
      informationProvided: 'Echo showed LVEF 45%, regional wall motion abnormality in anterior wall.',
    });

    assert.strictEqual(publishedEvents[1].type, 'ADDITIONAL_INFORMATION_SUBMITTED');
    assert.strictEqual(publishedEvents[1].recipientType, 'DISTRICT_HOSPITAL');
    assert.strictEqual(publishedEvents[1].recipientFacilityId, 'fac-dh-raigad');

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  console.log('\n--- 6. Complete 7-Step Realtime Healthcare Communication Loop Simulation ---');

  await test('6.1 Full Continuum Simulation: PATIENT -> ASHA -> PHC -> DH -> PHC -> ASHA -> PATIENT', async () => {
    let capturedEvents: RealtimeHealthcareEvent[] = [];
    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      const evt: RealtimeHealthcareEvent = {
        id: `evt-loop-${capturedEvents.length + 1}`,
        ...p,
        timestamp: new Date().toISOString(),
      };
      capturedEvents.push(evt);
      return evt;
    };

    // Mock DB operations for the full journey
    (supabase as any).from = (table: string) => ({
      insert: (data: any) => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { id: `${table}-id-100`, ...data },
              error: null,
            }),
        }),
      }),
      update: (data: any) => ({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { id: `${table}-id-100`, ...data },
                error: null,
              }),
          }),
        }),
      }),
    });

    const patientId = 'pat-suresh-101';
    const ashaId = 'asha-sunita-202';
    const phcFacilityId = 'fac-phc-karjat';
    const doctorId = 'doc-amit-303';
    const dhFacilityId = 'fac-dh-raigad';
    const specialistId = 'spec-sharma-404';

    // ==========================================
    // STEP 1 — PATIENT initiates assistance & appointment
    // ==========================================
    const step1 = await HealthcareJourneyLoopService.step1_patientInitiate({
      patientId,
      ashaId,
      phcFacilityId,
      requestType: 'Severe Chest Discomfort & Breathlessness',
      message: 'Need urgent evaluation and guidance.',
    });
    assert.ok(step1.ashaEvent, 'Step 1: ASHA event must be created');
    assert.ok(step1.phcEvent, 'Step 1: PHC event must be created');
    assert.strictEqual(step1.ashaEvent?.type, 'NEW_PATIENT_REQUEST');
    assert.strictEqual(step1.ashaEvent?.recipientUserId, ashaId);
    assert.strictEqual(step1.phcEvent?.type, 'APPOINTMENT_REQUESTED');
    assert.strictEqual(step1.phcEvent?.recipientFacilityId, phcFacilityId);

    // ==========================================
    // STEP 2 — ASHA evaluates and escalates to PHC
    // ==========================================
    const step2 = await HealthcareJourneyLoopService.step2_ashaEvaluate({
      patientId,
      ashaId,
      phcFacilityId,
      outcome: 'PHC_ATTENTION_REQUIRED',
      publicPatientUpdate: 'Assisted by ASHA. Referred to PHC doctor for urgent assessment.',
      internalAshaNotes: 'CONFIDENTIAL: BP 160/100, ECG strip shows ST changes, immediate doctor required.',
    });
    assert.strictEqual(step2.patientEvent.type, 'ASHA_FOLLOWUP_RECORDED');
    assert.strictEqual(step2.phcEvent?.type, 'PHC_FOLLOWUP_REQUEST');
    assert.strictEqual(step2.phcEvent?.recipientFacilityId, phcFacilityId);
    // Verify privacy: internal clinical notes are never present in event
    assert.strictEqual((step2.patientEvent as any).internalAshaNotes, undefined);
    assert.strictEqual((step2.phcEvent as any).internalAshaNotes, undefined);

    // ==========================================
    // STEP 3 — PHC evaluates and refers to District Hospital
    // ==========================================
    const step3 = await HealthcareJourneyLoopService.step3_phcEvaluate({
      patientId,
      doctorId,
      phcFacilityId,
      destinationDhFacilityId: dhFacilityId,
      outcome: 'REFER_TO_DISTRICT_HOSPITAL',
      priority: 'RED',
      reason: 'Acute Coronary Syndrome / NSTEMI',
      clinicalSummary: 'Troponin-T positive, ST depression in V4-V6. Requires cath lab angiography.',
      publicPatientSummary: 'Referred to Raigad District Hospital Cardiology Department for advanced care.',
      internalDoctorNotes: 'CONFIDENTIAL: High risk GRACE score 148, loaded with dual antiplatelet.',
    });
    assert.strictEqual(step3.dhReferralEvent?.type, 'NEW_REFERRAL');
    assert.strictEqual(step3.dhReferralEvent?.recipientFacilityId, dhFacilityId);
    assert.strictEqual(step3.patientNotificationEvent?.type, 'PATIENT_REFERRED_TO_HOSPITAL');
    assert.strictEqual(step3.patientNotificationEvent?.recipientUserId, patientId);

    // ==========================================
    // STEP 4 — DISTRICT HOSPITAL reviews, accepts, and schedules
    // ==========================================
    const referralId = step3.dhReferralEvent?.relatedEntityId || 'ref-loop-100';
    const step4Accept = await HealthcareJourneyLoopService.step4_districtHospitalProcess({
      referralId,
      patientId,
      dhFacilityId,
      phcFacilityId,
      specialistId,
      outcome: 'ACCEPTED',
    });
    assert.strictEqual(step4Accept.phcEvent.type, 'REFERRAL_ACCEPTED');
    assert.strictEqual(step4Accept.patientEvent?.type, 'REFERRAL_ACCEPTED');
    assert.strictEqual(step4Accept.patientEvent?.recipientUserId, patientId);

    // ==========================================
    // STEP 5 — DISTRICT HOSPITAL returns referral outcome to PHC
    // ==========================================
    const step5 = await HealthcareJourneyLoopService.step5_districtHospitalReturnToPhc({
      referralId,
      patientId,
      dhFacilityId,
      phcFacilityId,
      specialistId,
      treatmentSummary: 'Coronary angiography and successful DES stent placement to LAD. Patient stable.',
      followUpInstructions: 'Monitor blood pressure, administer Aspirin + Ticagrelor daily, weekly ASHA visit.',
    });
    assert.strictEqual(step5.phcOutcomeEvent.type, 'REFERRAL_RETURNED_TO_PHC');
    assert.strictEqual(step5.phcOutcomeEvent.recipientFacilityId, phcFacilityId);
    assert.strictEqual(step5.patientOutcomeEvent.type, 'HOSPITAL_TREATMENT_COMPLETED');
    assert.strictEqual(step5.patientOutcomeEvent.recipientUserId, patientId);

    // ==========================================
    // STEP 6 — PHC assigns community follow-up task to ASHA
    // ==========================================
    const step6 = await HealthcareJourneyLoopService.step6_phcAssignAshaFollowUp({
      patientId,
      phcFacilityId,
      ashaId,
      instructions: 'Check post-op vitals, surgical site, and dual antiplatelet compliance twice a week.',
      dueDate: '2026-05-22',
    });
    assert.strictEqual(step6.ashaTaskEvent.type, 'COMMUNITY_FOLLOW_UP_ASSIGNED');
    assert.strictEqual(step6.ashaTaskEvent.recipientUserId, ashaId);
    assert.strictEqual(step6.patientFollowUpDueEvent.type, 'FOLLOW_UP_DUE');
    assert.strictEqual(step6.patientFollowUpDueEvent.recipientUserId, patientId);

    // ==========================================
    // STEP 7 — ASHA completes community follow-up task & closes loop
    // ==========================================
    const step7 = await HealthcareJourneyLoopService.step7_ashaCompleteFollowUpTask({
      taskId: step6.ashaTaskEvent.relatedEntityId,
      patientId,
      ashaId,
      phcFacilityId,
      publicPatientUpdate: 'ASHA completed home visit. Patient is recovering well, vitals stable.',
      internalAshaNotes: 'CONFIDENTIAL: BP 122/78, pulse 72 regular, medications taken correctly.',
    });
    assert.strictEqual(step7.patientCompletionEvent.type, 'HOME_VISIT_COMPLETED');
    assert.strictEqual(step7.patientCompletionEvent.recipientUserId, patientId);
    assert.strictEqual(step7.phcCompletionEvent.type, 'ASHA_FOLLOWUP_COMPLETED');
    assert.strictEqual(step7.phcCompletionEvent.recipientFacilityId, phcFacilityId);
    // Verify privacy: zero internal clinical notes leaked
    assert.strictEqual((step7.patientCompletionEvent as any).internalAshaNotes, undefined);
    assert.strictEqual((step7.phcCompletionEvent as any).internalAshaNotes, undefined);

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  console.log('\n--- 7. Role-Based Restricted Messaging & Anti-Chat Security Enforcement ---');

  await test('7.1 PATIENT <-> ASSIGNED ASHA channel allows authorized messaging only', async () => {
    const patientContext: UserMessagingContext = { userId: 'pat-roshan-1', role: 'PATIENT' };
    const ashaContext: UserMessagingContext = { userId: 'asha-sunita-1', role: 'ASHA', assignedPatientIds: ['pat-roshan-1'] };

    // Valid: Patient initiates
    assert.doesNotThrow(() => {
      RoleBasedMessagingService.validateChannelAuthorization({
        channelType: 'PATIENT_ASHA',
        patientId: 'pat-roshan-1',
        ashaId: 'asha-sunita-1',
        initiatorContext: patientContext,
      });
    });

    // Valid: Assigned ASHA initiates
    assert.doesNotThrow(() => {
      RoleBasedMessagingService.validateChannelAuthorization({
        channelType: 'PATIENT_ASHA',
        patientId: 'pat-roshan-1',
        ashaId: 'asha-sunita-1',
        initiatorContext: ashaContext,
      });
    });
  });

  await test('7.2 PATIENT <-> PHC channel allows authorized PHC facility messaging only', async () => {
    const patientContext: UserMessagingContext = { userId: 'pat-roshan-1', role: 'PATIENT' };
    const phcContext: UserMessagingContext = { userId: 'doc-amit-1', role: 'PHC', facilityId: 'fac-phc-karjat' };

    assert.doesNotThrow(() => {
      RoleBasedMessagingService.validateChannelAuthorization({
        channelType: 'PATIENT_PHC',
        patientId: 'pat-roshan-1',
        phcFacilityId: 'fac-phc-karjat',
        initiatorContext: patientContext,
      });
    });

    assert.doesNotThrow(() => {
      RoleBasedMessagingService.validateChannelAuthorization({
        channelType: 'PATIENT_PHC',
        patientId: 'pat-roshan-1',
        phcFacilityId: 'fac-phc-karjat',
        initiatorContext: phcContext,
      });
    });
  });

  await test('7.3 ASHA <-> PHC channel allows coordination strictly for authorized patient', async () => {
    const ashaContext: UserMessagingContext = { userId: 'asha-sunita-1', role: 'ASHA', assignedPatientIds: ['pat-roshan-1'] };

    assert.doesNotThrow(() => {
      RoleBasedMessagingService.validateChannelAuthorization({
        channelType: 'ASHA_PHC',
        patientId: 'pat-roshan-1',
        ashaId: 'asha-sunita-1',
        phcFacilityId: 'fac-phc-karjat',
        initiatorContext: ashaContext,
      });
    });
  });

  await test('7.4 PHC <-> DISTRICT_HOSPITAL channel allows communication strictly for active referral', async () => {
    const phcContext: UserMessagingContext = { userId: 'doc-amit-1', role: 'PHC', facilityId: 'fac-phc-karjat' };

    assert.doesNotThrow(() => {
      RoleBasedMessagingService.validateChannelAuthorization({
        channelType: 'PHC_DISTRICT_HOSPITAL',
        patientId: 'pat-roshan-1',
        phcFacilityId: 'fac-phc-karjat',
        dhFacilityId: 'fac-dh-raigad',
        referralId: 'ref-dh-999',
        initiatorContext: phcContext,
      });
    });
  });

  await test('7.5 DISTRICT_HOSPITAL <-> PATIENT channel allows communication strictly for active care episode', async () => {
    const dhContext: UserMessagingContext = { userId: 'spec-1', role: 'DISTRICT_HOSPITAL', facilityId: 'fac-dh-raigad' };

    assert.doesNotThrow(() => {
      RoleBasedMessagingService.validateChannelAuthorization({
        channelType: 'DISTRICT_HOSPITAL_PATIENT',
        patientId: 'pat-roshan-1',
        dhFacilityId: 'fac-dh-raigad',
        referralId: 'ref-dh-999',
        initiatorContext: dhContext,
      });
    });
  });

  await test('7.6 FORBIDDEN: Patient-to-patient messaging is rejected', () => {
    const patientA: UserMessagingContext = { userId: 'pat-A', role: 'PATIENT' };

    assert.throws(() => {
      RoleBasedMessagingService.validateChannelAuthorization({
        channelType: 'PATIENT_ASHA',
        patientId: 'pat-B', // Impersonation attempt
        ashaId: 'asha-1',
        initiatorContext: patientA,
      });
    }, /SECURITY_ERROR/);
  });

  await test('7.7 FORBIDDEN: ASHA messaging unassigned patient is rejected', () => {
    const ashaContext: UserMessagingContext = { userId: 'asha-1', role: 'ASHA', assignedPatientIds: ['pat-1'] };

    assert.throws(() => {
      RoleBasedMessagingService.validateChannelAuthorization({
        channelType: 'PATIENT_ASHA',
        patientId: 'pat-unassigned-99',
        ashaId: 'asha-1',
        initiatorContext: ashaContext,
      });
    }, /SECURITY_ERROR/);
  });

  await test('7.8 FORBIDDEN: PHC messaging District Hospital without active referral is rejected', () => {
    const phcContext: UserMessagingContext = { userId: 'doc-1', role: 'PHC', facilityId: 'fac-phc-1' };

    assert.throws(() => {
      RoleBasedMessagingService.validateChannelAuthorization({
        channelType: 'PHC_DISTRICT_HOSPITAL',
        patientId: 'pat-1',
        phcFacilityId: 'fac-phc-1',
        dhFacilityId: 'fac-dh-1',
        referralId: undefined, // Missing referral
        initiatorContext: phcContext,
      });
    }, /SECURITY_ERROR/);
  });

  await test('7.9 FORBIDDEN: User knowing conversationId cannot access messages without authorization', async () => {
    const unauthorizedUser: UserMessagingContext = { userId: 'pat-intruder', role: 'PATIENT' };

    (supabase as any).from = (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'conv-private-100',
                channel_type: 'PATIENT_ASHA',
                patient_id: 'pat-victim-200',
                asha_id: 'asha-sunita',
              },
              error: null,
            }),
        }),
      }),
    });

    await assert.rejects(async () => {
      await RoleBasedMessagingService.getMessages('conv-private-100', unauthorizedUser);
    }, /SECURITY_ERROR/);
  });

  await test('7.10 Targeted Realtime Delivery: Message broadcast goes only to authorized recipient and never globally', async () => {
    const conv: ConversationRecord = {
      id: 'conv-test-100',
      channel_type: 'PATIENT_ASHA',
      patient_id: 'pat-roshan-1',
      asha_id: 'asha-sunita-1',
      created_at: new Date().toISOString(),
    };

    (supabase as any).from = (table: string) => {
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
        };
      }
      if (table === 'messages') {
        return {
          insert: (data: any) => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'msg-rec-1',
                    ...data,
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    };

    let capturedEvent: RealtimeHealthcareEvent | null = null;
    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      capturedEvent = { id: 'evt-msg-1', ...p, timestamp: new Date().toISOString() };
      return capturedEvent;
    };

    const res = await RoleBasedMessagingService.sendMessage({
      conversationId: 'conv-test-100',
      senderContext: { userId: 'pat-roshan-1', role: 'PATIENT' },
      message: 'Hello ASHA didi, I need assistance with my medicine dosage.',
    });

    assert.strictEqual(res.message.id, 'msg-rec-1');
    assert.ok(capturedEvent);
    assert.strictEqual(capturedEvent.type, 'NEW_MESSAGE');
    assert.strictEqual(capturedEvent.recipientType, 'ASHA');
    assert.strictEqual(capturedEvent.recipientUserId, 'asha-sunita-1');
    assert.strictEqual(capturedEvent.patientId, 'pat-roshan-1');

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  console.log('\n--- 8. Role-Based Notification System & Security Tests ---');

  await test('8.1 PATIENT: Receives only authorized personal notifications (appointment, referral, report, follow-up)', () => {
    const patientContext: UserNotificationContext = { userId: 'pat-roshan-1', role: 'PATIENT', patientId: 'pat-roshan-1' };

    // Valid own appointment notification
    assert.doesNotThrow(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientUserId: 'pat-roshan-1',
        recipientRole: 'PATIENT',
        type: 'APPOINTMENT_CONFIRMED',
        patientId: 'pat-roshan-1',
        title: 'Appointment Confirmed',
        message: 'Your PHC appointment has been confirmed.',
        recipientContext: patientContext,
      });
    });

    // Valid own referral notification
    assert.doesNotThrow(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientUserId: 'pat-roshan-1',
        recipientRole: 'PATIENT',
        type: 'REFERRAL_ACCEPTED',
        patientId: 'pat-roshan-1',
        title: 'Referral Accepted',
        message: 'Your referral has been accepted by District Hospital.',
        recipientContext: patientContext,
      });
    });

    // Valid own diagnostic report notification
    assert.doesNotThrow(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientUserId: 'pat-roshan-1',
        recipientRole: 'PATIENT',
        type: 'DIAGNOSTIC_REPORT_AVAILABLE',
        patientId: 'pat-roshan-1',
        title: 'Report Available',
        message: 'Your diagnostic report is now available.',
        recipientContext: patientContext,
      });
    });
  });

  await test('8.2 PATIENT: Unauthorized access to another patient notification is rejected', () => {
    const patientContext: UserNotificationContext = { userId: 'pat-roshan-1', role: 'PATIENT', patientId: 'pat-roshan-1' };

    assert.throws(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientUserId: 'pat-other-user',
        recipientRole: 'PATIENT',
        type: 'APPOINTMENT_CONFIRMED',
        patientId: 'pat-other-user',
        title: 'Appointment Confirmed',
        message: 'Your PHC appointment has been confirmed.',
        recipientContext: patientContext,
      });
    }, /SECURITY_ERROR/);
  });

  await test('8.3 ASHA: Receives notifications only for assigned patients & tasks; unassigned patient rejected', () => {
    const ashaContext: UserNotificationContext = {
      userId: 'asha-sunita',
      role: 'ASHA',
      assignedPatientIds: ['pat-roshan-1', 'pat-anita-2'],
    };

    // Valid assigned patient request
    assert.doesNotThrow(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientUserId: 'asha-sunita',
        recipientRole: 'ASHA',
        type: 'NEW_PATIENT_REQUEST',
        patientId: 'pat-roshan-1',
        title: 'New Patient Request',
        message: 'New patient assistance request.',
        recipientContext: ashaContext,
      });
    });

    // Valid follow-up task assigned
    assert.doesNotThrow(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientUserId: 'asha-sunita',
        recipientRole: 'ASHA',
        type: 'FOLLOW_UP_ASSIGNED',
        patientId: 'pat-anita-2',
        title: 'Follow-up Assigned',
        message: 'New follow-up task assigned by PHC.',
        recipientContext: ashaContext,
      });
    });

    // Invalid unassigned patient notification
    assert.throws(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientUserId: 'asha-sunita',
        recipientRole: 'ASHA',
        type: 'NEW_PATIENT_REQUEST',
        patientId: 'pat-stranger-999',
        title: 'New Patient Request',
        message: 'New patient assistance request.',
        recipientContext: ashaContext,
      });
    }, /SECURITY_ERROR/);
  });

  await test('8.4 PHC: Receives notifications for authorized facility cases; other PHC notifications rejected', () => {
    const phcContext: UserNotificationContext = {
      userId: 'dr-kulkarni',
      role: 'PHC',
      facilityId: 'fac-phc-karjat',
    };

    // Valid appointment request for this PHC
    assert.doesNotThrow(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientRole: 'PHC',
        recipientFacilityId: 'fac-phc-karjat',
        type: 'NEW_APPOINTMENT_REQUEST',
        patientId: 'pat-roshan-1',
        title: 'New Appointment Request',
        message: 'Patient requested an appointment.',
        recipientContext: phcContext,
      });
    });

    // Valid district hospital referral update
    assert.doesNotThrow(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientRole: 'PHC',
        recipientFacilityId: 'fac-phc-karjat',
        type: 'DISTRICT_HOSPITAL_UPDATE',
        patientId: 'pat-roshan-1',
        title: 'Hospital Update',
        message: 'Referral status updated by District Hospital.',
        recipientContext: phcContext,
      });
    });

    // Invalid: Notification targeted at a different PHC facility
    assert.throws(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientRole: 'PHC',
        recipientFacilityId: 'fac-phc-alibag', // Different PHC
        type: 'NEW_APPOINTMENT_REQUEST',
        patientId: 'pat-roshan-1',
        title: 'New Appointment Request',
        message: 'Patient requested an appointment.',
        recipientContext: phcContext,
      });
    }, /SECURITY_ERROR/);
  });

  await test('8.5 DISTRICT_HOSPITAL: Receives notifications only for assigned referrals; other hospital rejected', () => {
    const dhContext: UserNotificationContext = {
      userId: 'dr-patil-dh',
      role: 'DISTRICT_HOSPITAL',
      facilityId: 'fac-dh-raigad',
    };

    // Valid new referral for Raigad DH
    assert.doesNotThrow(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientRole: 'DISTRICT_HOSPITAL',
        recipientFacilityId: 'fac-dh-raigad',
        type: 'NEW_REFERRAL',
        patientId: 'pat-roshan-1',
        title: 'New Referral',
        message: 'New referral received from PHC.',
        recipientContext: dhContext,
      });
    });

    // Valid urgent referral
    assert.doesNotThrow(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientRole: 'DISTRICT_HOSPITAL',
        recipientFacilityId: 'fac-dh-raigad',
        type: 'URGENT_REFERRAL',
        patientId: 'pat-roshan-1',
        title: 'Urgent Referral',
        message: 'Urgent referral requires attention.',
        recipientContext: dhContext,
      });
    });

    // Invalid: Notification targeted at Thane DH received by Raigad DH
    assert.throws(() => {
      RoleBasedNotificationService.validateNotificationAuthorization({
        recipientRole: 'DISTRICT_HOSPITAL',
        recipientFacilityId: 'fac-dh-thane',
        type: 'NEW_REFERRAL',
        patientId: 'pat-roshan-1',
        title: 'New Referral',
        message: 'New referral received from PHC.',
        recipientContext: dhContext,
      });
    }, /SECURITY_ERROR/);
  });

  await test('8.6 Notification Priority: Correctly calculates priority (LOW, NORMAL, HIGH, URGENT)', async () => {
    (supabase as any).from = (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      insert: (data: any) => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'notif-prio-1', ...data }, error: null }),
        }),
      }),
    });

    // Urgent referral -> URGENT priority
    const urgentNotif = await RoleBasedNotificationService.createNotification({
      recipientRole: 'DISTRICT_HOSPITAL',
      recipientFacilityId: 'fac-dh-raigad',
      type: 'URGENT_REFERRAL',
      title: 'Urgent Referral',
      message: 'Urgent referral requires attention.',
      actorContext: { userId: 'dr-kulkarni', role: 'PHC', facilityId: 'fac-phc-karjat' },
    });
    assert.strictEqual(urgentNotif.notification.priority, 'URGENT');

    // New referral -> HIGH priority
    const highNotif = await RoleBasedNotificationService.createNotification({
      recipientRole: 'DISTRICT_HOSPITAL',
      recipientFacilityId: 'fac-dh-raigad',
      type: 'NEW_REFERRAL',
      title: 'New Referral',
      message: 'New referral received from PHC.',
      actorContext: { userId: 'dr-kulkarni', role: 'PHC', facilityId: 'fac-phc-karjat' },
    });
    assert.strictEqual(highNotif.notification.priority, 'HIGH');

    // Routine appointment reminder -> NORMAL priority
    const normalNotif = await RoleBasedNotificationService.createNotification({
      recipientUserId: 'pat-roshan-1',
      recipientRole: 'PATIENT',
      patientId: 'pat-roshan-1',
      type: 'APPOINTMENT_REMINDER',
      title: 'Appointment Reminder',
      message: 'You have an upcoming appointment scheduled.',
      actorContext: { userId: 'system', role: 'PHC', facilityId: 'fac-phc-karjat' },
    });
    assert.strictEqual(normalNotif.notification.priority, 'NORMAL');
  });

  await test('8.7 Patient Privacy: Sanitizes title and message against clinical leakage', async () => {
    (supabase as any).from = (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      insert: (data: any) => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'notif-priv-1', ...data }, error: null }),
        }),
      }),
    });

    const notif = await RoleBasedNotificationService.createNotification({
      recipientUserId: 'pat-roshan-1',
      recipientRole: 'PATIENT',
      patientId: 'pat-roshan-1',
      type: 'PRESCRIPTION_CREATED',
      title: 'Diagnosed with Acute Myocardial Infarction',
      message: 'Prescription for Atorvastatin 40mg and Metoprolol 50mg created.',
      actorContext: { userId: 'dr-kulkarni', role: 'PHC' },
    });

    assert.ok(!notif.notification.title.includes('Myocardial Infarction'));
    assert.ok(!notif.notification.message.includes('Atorvastatin'));
    assert.strictEqual(notif.notification.message, 'Your consultation record has been updated.');
  });

  await test('8.8 Idempotency: Duplicate notifications with same key are prevented', async () => {
    const existingNotif: RoleNotification = {
      id: 'existing-notif-100',
      recipient_user_id: 'pat-roshan-1',
      recipient_role: 'PATIENT',
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Appointment Confirmed',
      message: 'Your appointment has been confirmed.',
      patient_id: 'pat-roshan-1',
      related_entity_id: 'apt-101',
      related_entity_type: 'APPOINTMENT',
      priority: 'NORMAL',
      is_read: false,
      idempotency_key: 'idemp-apt-101-confirmed',
      created_at: new Date().toISOString(),
    };

    (supabase as any).from = (table: string) => {
      if (table === 'role_notifications') {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              maybeSingle: () => Promise.resolve({ data: existingNotif, error: null }),
            }),
          }),
        };
      }
      return {};
    };

    const duplicateResult = await RoleBasedNotificationService.createNotification({
      recipientUserId: 'pat-roshan-1',
      recipientRole: 'PATIENT',
      patientId: 'pat-roshan-1',
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Appointment Confirmed',
      message: 'Your appointment has been confirmed.',
      relatedEntityId: 'apt-101',
      relatedEntityType: 'APPOINTMENT',
      idempotencyKey: 'idemp-apt-101-confirmed',
      actorContext: { userId: 'dr-kulkarni', role: 'PHC' },
    });

    assert.strictEqual(duplicateResult.notification.id, 'existing-notif-100');
    assert.strictEqual(duplicateResult.isDuplicate, true);
  });

  await test('8.9 Re-authorization On Click: verifyEntityAccess blocks unauthorized entities', async () => {
    const patientContext: UserNotificationContext = { userId: 'pat-roshan-1', role: 'PATIENT', patientId: 'pat-roshan-1' };
    const strangerContext: UserNotificationContext = { userId: 'pat-stranger-99', role: 'PATIENT', patientId: 'pat-stranger-99' };

    (supabase as any).from = (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { id: 'pat-roshan-1', patient_id: 'pat-roshan-1' }, error: null }),
        }),
      }),
    });

    // Same patient entity access allowed
    const canAccessOwn = await RoleBasedNotificationService.verifyEntityAccess(
      'pat-roshan-1',
      'appointment',
      patientContext
    );
    assert.strictEqual(canAccessOwn.authorized, true);

    // Other patient entity access blocked
    const canAccessOther = await RoleBasedNotificationService.verifyEntityAccess(
      'pat-roshan-1',
      'appointment',
      strangerContext
    );
    assert.strictEqual(canAccessOther.authorized, false);
  });

  console.log('\n--- 9. Role-Based Profile & Onboarding System Tests ---');

  await test('9.1 Canonical Role Normalization (Exactly 4 Roles)', () => {
    assert.strictEqual(OnboardingProfileService.normalizeRole('patient'), 'PATIENT');
    assert.strictEqual(OnboardingProfileService.normalizeRole('PATIENT'), 'PATIENT');
    assert.strictEqual(OnboardingProfileService.normalizeRole('asha_worker'), 'ASHA');
    assert.strictEqual(OnboardingProfileService.normalizeRole('ASHA'), 'ASHA');
    assert.strictEqual(OnboardingProfileService.normalizeRole('phc_doctor'), 'PHC');
    assert.strictEqual(OnboardingProfileService.normalizeRole('PHC'), 'PHC');
    assert.strictEqual(OnboardingProfileService.normalizeRole('district_hospital'), 'DISTRICT_HOSPITAL');
    assert.strictEqual(OnboardingProfileService.normalizeRole('DISTRICT_HOSPITAL'), 'DISTRICT_HOSPITAL');
  });

  await test('9.2 PATIENT Onboarding: Validates required health profile and distinguishes non-clinical entry', async () => {
    // Missing required field throws VALIDATION_ERROR
    await assert.rejects(
      async () => {
        await OnboardingProfileService.completePatientProfile('u-pat-test-1', {
          full_name: '',
          phone: '9840219283',
          address: 'Ward 2',
          village: 'Dhamangaon',
          district: 'Raigad',
          state: 'Maharashtra',
          gender: 'M',
          age: 28,
          emergency_contact_name: 'Ramesh',
          emergency_contact_phone: '9822000000',
          emergency_contact_relation: 'Brother',
        });
      },
      /VALIDATION_ERROR: Full Name is required/
    );

    // Invalid phone throws VALIDATION_ERROR
    await assert.rejects(
      async () => {
        await OnboardingProfileService.completePatientProfile('u-pat-test-1', {
          full_name: 'Roshan Sahani',
          phone: '123',
          address: 'Ward 2',
          village: 'Dhamangaon',
          district: 'Raigad',
          state: 'Maharashtra',
          gender: 'M',
          age: 28,
          emergency_contact_name: 'Ramesh',
          emergency_contact_phone: '9822000000',
          emergency_contact_relation: 'Brother',
        });
      },
      /VALIDATION_ERROR: Please enter a valid 10-digit mobile phone number/
    );

    // Valid submission with mock supabase
    (supabase as any).from = (table: string) => {
      if (table === 'patient_profiles') {
        return {
          upsert: (payload: any) => ({
            select: () => ({
              single: () => Promise.resolve({ data: { ...payload, id: 'pp-1', is_patient_provided: true }, error: null }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      return {};
    };

    const validResult = await OnboardingProfileService.completePatientProfile('u-pat-test-1', {
      full_name: 'Roshan Sahani',
      phone: '9840219283',
      address: 'Ward 2 (Gavali Galli)',
      village: 'Dhamangaon',
      district: 'Raigad',
      state: 'Maharashtra',
      gender: 'M',
      age: 28,
      emergency_contact_name: 'Sanjay Sahani',
      emergency_contact_phone: '9822010800',
      emergency_contact_relation: 'Father',
      known_allergies: ['Penicillin'],
      existing_conditions: ['Hypertension'],
    });

    assert.strictEqual(validResult.success, true);
    assert.strictEqual(validResult.profile?.full_name, 'Roshan Sahani');
    assert.strictEqual(validResult.profile?.is_patient_provided, true);
  });

  await test('9.3 ASHA Onboarding: Validates work assignment and saves ASHA profile', async () => {
    (supabase as any).from = (table: string) => {
      if (table === 'asha_profiles') {
        return {
          upsert: (payload: any) => ({
            select: () => ({
              single: () => Promise.resolve({ data: { ...payload, id: 'ap-1' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      return {};
    };

    const ashaResult = await OnboardingProfileService.completeAshaProfile('u-asha-test-1', {
      full_name: 'Sunita More',
      phone: '9840219283',
      address: 'Dhamangaon Village',
      asha_worker_id: 'ASHA-MH-2024-884',
      assigned_village: 'Dhamangaon',
      block: 'Karjat',
      district: 'Raigad',
      state: 'Maharashtra',
      primary_phc_name: 'Dhamangaon PHC',
      villages_served: ['Dhamangaon', 'Palsari'],
    });

    assert.strictEqual(ashaResult.success, true);
    assert.strictEqual(ashaResult.profile?.assigned_village, 'Dhamangaon');
    assert.strictEqual(ashaResult.profile?.primary_phc_name, 'Dhamangaon PHC');
  });

  await test('9.4 PHC Onboarding: Configures facility, provider info, and available services', async () => {
    (supabase as any).from = (table: string) => {
      if (table === 'phc_profiles') {
        return {
          upsert: (payload: any) => ({
            select: () => ({
              single: () => Promise.resolve({ data: { ...payload, id: 'phc-1' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      return {};
    };

    const phcResult = await OnboardingProfileService.completePhcProfile('u-phc-test-1', {
      phc_name: 'Dhamangaon Primary Health Centre',
      phone: '9822010800',
      doctor_name: 'Dr. Amit Deshmukh',
      doctor_designation: 'Medical Officer',
      address: 'Near Gram Panchayat',
      village: 'Dhamangaon',
      block: 'Karjat',
      district: 'Raigad',
      state: 'Maharashtra',
      pincode: '410201',
      operating_hours: '9:00 AM - 5:00 PM (24x7 Emergency)',
      services_offered: ['General Consultation', 'Maternal Health', 'Immunization'],
    });

    assert.strictEqual(phcResult.success, true);
    assert.strictEqual(phcResult.profile?.doctor_name, 'Dr. Amit Deshmukh');
    assert.deepStrictEqual(phcResult.profile?.services_offered, ['General Consultation', 'Maternal Health', 'Immunization']);
  });

  await test('9.5 DISTRICT_HOSPITAL Onboarding: Configures facility, emergency contact, and specialties', async () => {
    (supabase as any).from = (table: string) => {
      if (table === 'district_hospital_profiles') {
        return {
          upsert: (payload: any) => ({
            select: () => ({
              single: () => Promise.resolve({ data: { ...payload, id: 'dh-1' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      return {};
    };

    const dhResult = await OnboardingProfileService.completeDistrictHospitalProfile('u-dh-test-1', {
      hospital_name: 'Raigad District General Hospital',
      phone: '9822001122',
      emergency_phone: '108',
      email: 'raigad.dh@hospital.gov.in',
      address: 'Alibag Main Road',
      city: 'Alibag',
      district: 'Raigad',
      state: 'Maharashtra',
      pincode: '402201',
      operating_hours: '24x7 Emergency & Trauma',
      services_offered: ['Emergency Services', 'Specialist Consultation', 'Surgery', 'Diagnostics'],
      specialties_offered: ['Cardiology', 'Orthopedics', 'Pediatrics', 'Gynecology'],
    });

    assert.strictEqual(dhResult.success, true);
    assert.strictEqual(dhResult.profile?.hospital_name, 'Raigad District General Hospital');
    assert.ok(dhResult.profile?.specialties_offered?.includes('Cardiology'));
  });

  await test('9.6 Profile Security & RBAC: Rejects unauthorized actor or role escalation attempt', async () => {
    let updatedPayload: any = null;
    (supabase as any).from = (table: string) => ({
      update: (payload: any) => {
        updatedPayload = payload;
        return {
          eq: () => Promise.resolve({ error: null }),
        };
      },
    });

    // Unauthorized actor
    await assert.rejects(
      async () => {
        await OnboardingProfileService.updateRoleProfile(
          'u-pat-1',
          'PATIENT',
          { full_name: 'Hacked Name' },
          'u-attacker-999'
        );
      },
      /SECURITY_ERROR: Unauthorized/
    );

    // Sensitive field stripping check
    const updateAttempt = await OnboardingProfileService.updateRoleProfile(
      'u-pat-1',
      'PATIENT',
      {
        full_name: 'Roshan Sahani Updated',
        role: 'DISTRICT_HOSPITAL', // Attempt privilege escalation
        user_id: 'u-admin-1', // Attempt ID spoofing
      },
      'u-pat-1'
    );

    assert.strictEqual(updateAttempt.success, true);
    assert.strictEqual(updatedPayload.role, undefined);
    assert.strictEqual(updatedPayload.user_id, undefined);
    assert.strictEqual(updatedPayload.full_name, 'Roshan Sahani Updated');
  });

  await test('9.7 Save & Resume Progressive Draft Flow', async () => {
    let savedDraft: any = null;
    (supabase as any).from = (table: string) => ({
      update: (payload: any) => {
        savedDraft = payload.onboarding_draft;
        return {
          eq: () => Promise.resolve({ error: null }),
        };
      },
    });

    const draftResult = await OnboardingProfileService.saveDraftProfile(
      'u-asha-draft-1',
      { role: 'ASHA', stepData: { fullName: 'Sunita Draft', assignedVillage: 'Dhamangaon' } }
    );

    assert.strictEqual(draftResult, true);
    assert.strictEqual(savedDraft.role, 'ASHA');
    assert.strictEqual(savedDraft.stepData.fullName, 'Sunita Draft');
  });

  console.log(`\n======================================================`);
  console.log(`All Tests Completed: ${passed} passed, ${failed} failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
