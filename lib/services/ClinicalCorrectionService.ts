import { supabase } from '../supabaseClient';

export class ClinicalCorrectionService {
  /**
   * Modifies a clinical record (like a consultation or visit notes).
   * Since clinical data must preserve history, this creates an audit log entry explicitly
   * and can optionally implement versioning if the table supports supersedes_id.
   * For Phase 3, we update the row but rely on the audit_logs for the history, OR
   * if it's a versioned table (like documents or consent), we insert a new row.
   */
  static async updateClinicalRecord(
    table: 'asha_visits' | 'consultations' | 'prescriptions', 
    recordId: string, 
    updates: Record<string, any>, 
    userId: string,
    reason: string
  ) {
    // 1. Fetch current state
    const { data: beforeState, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('id', recordId)
      .single();

    if (fetchError) throw new Error(`Could not fetch original record: ${fetchError.message}`);

    // 2. Perform the update
    const { data: afterState, error: updateError } = await supabase
      .from(table)
      .update(updates)
      .eq('id', recordId)
      .select()
      .single();

    if (updateError) throw new Error(`Update failed: ${updateError.message}`);

    // 3. Log the correction explicitly in the audit_log
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        actor_id: userId,
        entity_type: table === 'asha_visits' ? 'visit' : table === 'consultations' ? 'consultation' : 'prescription',
        entity_id: recordId,
        action: 'CORRECTION',
        reason: reason,
        before_state: beforeState,
        after_state: afterState
      });

    if (auditError) console.error("Failed to write audit log for correction:", auditError);

    return afterState;
  }
}
