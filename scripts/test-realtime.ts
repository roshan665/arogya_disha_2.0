import assert from 'node:assert';
import {
  RealtimeCommunicationService,
  RealtimeEventAuthorizer,
  RealtimeHealthcareEvent,
  ContextUser,
} from '../lib/services/RealtimeCommunicationService';
import { PatientAshaCommunicationService } from '../lib/services/PatientAshaCommunicationService';
import { supabase } from '../lib/supabaseClient';

async function runTests() {
  console.log('--- Starting ArogyaDisha Realtime Communication Tests ---');
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✓ ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(err);
        failed++;
      }
    })();
  }

  // 1. Security & Payload Sanitization
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

  await test('1.2 rejects invalid roles outside the 4 core roles', () => {
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

  // 2. Authorization Engine checks
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

  await test('2.3 PHC scope: Only target facility or caring PHC receives PHC events', () => {
    const phcEvent: RealtimeHealthcareEvent = {
      ...baseEvent,
      recipientType: 'PHC',
      patientId: 'pat-phc-care',
      recipientFacilityId: 'fac-phc-karjat',
    };

    const phcStaff: ContextUser = { userId: 'doc-amit', role: 'PHC', facilityId: 'fac-phc-karjat' };
    const otherPhcStaff: ContextUser = { userId: 'doc-other', role: 'PHC', facilityId: 'fac-phc-pune' };

    assert.strictEqual(RealtimeEventAuthorizer.isAuthorizedRecipient(phcEvent, phcStaff), true);
    assert.strictEqual(RealtimeEventAuthorizer.isAuthorizedRecipient(phcEvent, otherPhcStaff), false);
  });

  // 3. Mocked Service tests for Patient-ASHA interactions
  await test('3.1 PATIENT -> ASHA request creates assistance request and NEW_PATIENT_REQUEST event', async () => {
    let insertedData: any = null;
    let publishedEventPayload: any = null;

    // mock supabase
    (supabase as any).from = (table: string) => ({
      insert: (data: any) => {
        insertedData = data;
        return {
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
        };
      },
    });

    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      publishedEventPayload = p;
      return {
        id: 'evt-req-1',
        ...p,
        timestamp: new Date().toISOString(),
      };
    };

    const result = await PatientAshaCommunicationService.requestAshaAssistance({
      patientId: 'pat-roshan',
      ashaId: 'asha-sunita',
      requestType: 'HOME_VISIT',
      message: 'Need help with blood pressure checkup',
    });

    assert.strictEqual(result.request.id, 'req-1');
    assert.strictEqual(publishedEventPayload.type, 'NEW_PATIENT_REQUEST');
    assert.strictEqual(publishedEventPayload.actorRole, 'PATIENT');
    assert.strictEqual(publishedEventPayload.recipientType, 'ASHA');
    assert.strictEqual(publishedEventPayload.recipientUserId, 'asha-sunita');

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  await test('3.2 ASHA -> PATIENT status update dispatches REQUEST_ACCEPTED to patient', async () => {
    let publishedEventPayload: any = null;

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

    const origPublish = RealtimeCommunicationService.publishEvent;
    RealtimeCommunicationService.publishEvent = async (p: any) => {
      publishedEventPayload = p;
      return {
        id: 'evt-status-1',
        ...p,
        timestamp: new Date().toISOString(),
      };
    };

    const result = await PatientAshaCommunicationService.updateAssistanceRequestStatus({
      requestId: 'req-1',
      patientId: 'pat-roshan',
      ashaId: 'asha-sunita',
      status: 'ACCEPTED',
    });

    assert.strictEqual(result.updated.status, 'ACCEPTED');
    assert.strictEqual(publishedEventPayload.type, 'REQUEST_ACCEPTED');
    assert.strictEqual(publishedEventPayload.actorRole, 'ASHA');
    assert.strictEqual(publishedEventPayload.recipientType, 'PATIENT');
    assert.strictEqual(publishedEventPayload.recipientUserId, 'pat-roshan');

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
      return {
        id: `evt-${publishedEvents.length}`,
        ...p,
        timestamp: new Date().toISOString(),
      };
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

    // Patient event:
    const patientEvt = publishedEvents.find((e) => e.recipientType === 'PATIENT');
    assert.ok(patientEvt);
    assert.strictEqual(patientEvt.type, 'ASHA_FOLLOWUP_RECORDED');
    // Ensure zero confidential notes in realtime payload
    assert.strictEqual((patientEvt as any).internalAshaNotes, undefined);
    assert.strictEqual((patientEvt as any).internal_asha_notes, undefined);

    // PHC escalation event:
    const phcEvt = publishedEvents.find((e) => e.recipientType === 'PHC');
    assert.ok(phcEvt);
    assert.strictEqual(phcEvt.type, 'PHC_FOLLOWUP_REQUEST');
    assert.strictEqual(phcEvt.recipientFacilityId, 'fac-phc-karjat');

    RealtimeCommunicationService.publishEvent = origPublish;
  });

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
