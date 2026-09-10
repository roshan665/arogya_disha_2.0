import { NotificationService } from './NotificationService';
import { QueueService } from './QueueService';
import { supabase } from '../supabaseClient';

export class EmergencyService {
  /**
   * Triggers a massive system-wide emergency bypass.
   * - Books priority slot
   * - Bypasses standard check-in
   * - Blasts real-time alerts
   */
  static async triggerEmergencyReferral(patientId: string, actorId: string, targetFacilityId: string, clinicalReason: string) {
    if (!clinicalReason || clinicalReason.length < 10) {
      throw new Error("VALIDATION_ERROR: A detailed clinical reason is required to trigger an emergency.");
    }

    // 1. Audit the Emergency Trigger (Un-modifiable)
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      entity_type: 'patient',
      entity_id: patientId,
      action: 'EMERGENCY_TRIGGERED',
      after_state: { reason: clinicalReason, targetFacilityId }
    });

    // 2. Blast Real-Time Alert to Destination Facility
    await NotificationService.publishEvent({
      userId: targetFacilityId, // Targets anyone at this facility in a real setup
      title: '🚨 INBOUND EMERGENCY',
      message: `Emergency referral inbound. Reason: ${clinicalReason}`,
      type: 'EMERGENCY_CREATED',
      entityId: patientId,
      entityType: 'patient'
    });

    // 3. Multi-role Minimal Realtime Event Fanout (PHC, District Hospital, ASHA)
    try {
      const { RealtimeCommunicationService } = await import('./RealtimeCommunicationService');
      await RealtimeCommunicationService.fanoutEvent(
        {
          type: 'EMERGENCY_TRIGGERED',
          actorId: actorId,
          actorRole: 'PATIENT',
          patientId: patientId,
          relatedEntityId: patientId,
          relatedEntityType: 'emergency',
        },
        [
          { recipientType: 'DISTRICT_HOSPITAL', recipientFacilityId: targetFacilityId },
          { recipientType: 'PHC', recipientFacilityId: targetFacilityId },
          { recipientType: 'ASHA' }
        ]
      );
    } catch (e) {
      console.warn('Emergency realtime event fanout suppressed:', e);
    }

    // 4. (Mock) Auto-slot into priority queue
    return { status: 'EMERGENCY_ROUTED', priority_score: 999 };
  }
}
