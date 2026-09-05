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

    // 3. (Mock) Auto-slot into priority queue
    // In reality, this would call AppointmentRepository to secure the first available slot.
    return { status: 'EMERGENCY_ROUTED', priority_score: 999 };
  }
}
