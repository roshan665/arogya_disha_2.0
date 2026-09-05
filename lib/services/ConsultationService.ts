import { supabase } from '../supabaseClient';

export class ConsultationService {
  /**
   * Strictly validates that required clinical fields are present before allowing a consultation to be marked as COMPLETED.
   */
  static async completeConsultation(consultationId: string, doctorId: string, overrideReason?: string) {
    const { data: consultation, error } = await supabase
      .from('consultations')
      .select('*')
      .eq('id', consultationId)
      .single();

    if (error) throw new Error(`Consultation fetch failed: ${error.message}`);
    if (consultation.status === 'COMPLETED') throw new Error('Consultation is already completed.');

    // 1. Validate Required Fields
    const missingFields = [];
    if (!consultation.assessment) missingFields.push('Assessment');
    if (!consultation.treatment) missingFields.push('Treatment Plan');
    if (!consultation.outcome) missingFields.push('Outcome');

    if (missingFields.length > 0) {
      if (!overrideReason) {
        throw new Error(`CLINICAL_VALIDATION_ERROR: Cannot complete consultation. Missing required fields: ${missingFields.join(', ')}. Provide an override reason to bypass.`);
      }
      
      // Log the exception
      await supabase.from('audit_logs').insert({
        actor_id: doctorId,
        entity_type: 'consultation',
        entity_id: consultationId,
        action: 'COMPLETION_EXCEPTION',
        before_state: { missingFields },
        after_state: { overrideReason }
      });
    }

    // 2. Commit Completion
    const { data: updated, error: updateErr } = await supabase
      .from('consultations')
      .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
      .eq('id', consultationId)
      .select()
      .single();

    if (updateErr) throw new Error(updateErr.message);

    return updated;
  }
}
