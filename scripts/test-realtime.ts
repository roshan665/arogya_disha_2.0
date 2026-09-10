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
    // Verify internal notes are NOT present in realtime event
    assert.strictEqual((publishedEvent as any).internalClinicalNotes, undefined);
    assert.strictEqual((publishedEvent as any).internal_clinical_notes, undefined);

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

  console.log(`\n======================================================`);
  console.log(`All Tests Completed: ${passed} passed, ${failed} failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
