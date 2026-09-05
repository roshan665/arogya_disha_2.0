import { supabase } from '../supabaseClient';

export interface Referral {
  id: string;
  patient_id: string;
  referring_user_id: string;
  source_facility_id?: string;
  destination_facility_id: string;
  status: string;
  urgency: string;
  reason: string;
  rejection_reason?: string;
}

export class ReferralRepository {
  static async getReferral(referralId: string): Promise<Referral> {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .single();

    if (error) throw new Error(error.message);
    return data as Referral;
  }

  static async updateReferralState(
    referralId: string, 
    newState: string, 
    actorId: string, 
    additionalData: any = {}
  ): Promise<Referral> {
    // 1. Fetch before state for audit log
    const { data: beforeState, error: fetchErr } = await supabase
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .single();
    
    if (fetchErr) throw new Error(fetchErr.message);

    // 2. Perform Update
    const { data: afterState, error: updateErr } = await supabase
      .from('referrals')
      .update({ status: newState, ...additionalData })
      .eq('id', referralId)
      .select()
      .single();

    if (updateErr) throw new Error(updateErr.message);

    // 3. Write Audit Log (Transaction-like)
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      entity_type: 'referral',
      entity_id: referralId,
      action: `STATE_CHANGE_${newState.toUpperCase()}`,
      before_state: beforeState,
      after_state: afterState
    });

    return afterState as Referral;
  }
}
