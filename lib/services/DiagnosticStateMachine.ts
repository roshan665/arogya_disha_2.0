import { supabase } from '../supabaseClient';
import { NotificationService } from './NotificationService';

export class DiagnosticStateMachine {
  private static VALID_TRANSITIONS: Record<string, string[]> = {
    'ORDERED': ['SCHEDULED', 'SAMPLE_COLLECTED', 'CANCELLED'],
    'SCHEDULED': ['SAMPLE_COLLECTED', 'CANCELLED'],
    'SAMPLE_COLLECTED': ['REPORT_GENERATED', 'CANCELLED'],
    'REPORT_GENERATED': ['VERIFIED'],
    'VERIFIED': ['DOCTOR_REVIEWED', 'PUBLISHED'],
    'DOCTOR_REVIEWED': ['PUBLISHED'],
    'PUBLISHED': [],
    'CANCELLED': []
  };

  static async transition(orderId: string, currentState: string, newState: string, actorId: string, resultData?: string) {
    const allowed = this.VALID_TRANSITIONS[currentState];
    if (!allowed || !allowed.includes(newState)) {
      throw new Error(`INVALID_TRANSITION: Cannot transition diagnostic from '${currentState}' to '${newState}'.`);
    }

    const updates: any = { status: newState, updated_at: new Date().toISOString() };
    if (resultData && ['REPORT_GENERATED', 'VERIFIED'].includes(newState)) {
        updates.result = resultData;
    }

    const { data, error } = await supabase
      .from('diagnostic_orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Audit
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      entity_type: 'diagnostic',
      entity_id: orderId,
      action: `DIAGNOSTIC_${newState}`,
      after_state: data
    });

    // Domain Event -> Realtime Notification
    if (newState === 'REPORT_GENERATED' || newState === 'VERIFIED') {
      // Notify the ordering doctor
      // In a real app we would fetch the doctor_id from the consultation
      const doctorId = 'mock-doctor-id'; 
      await NotificationService.publishEvent({
        userId: doctorId,
        title: `Diagnostic Result ${newState}`,
        message: `The lab result for order ${orderId} is now ${newState}.`,
        type: 'DIAGNOSTIC_RESULT_AVAILABLE',
        entityId: orderId,
        entityType: 'diagnostic'
      });
    }

    return data;
  }
}
