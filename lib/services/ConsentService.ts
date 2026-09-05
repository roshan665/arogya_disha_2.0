import { supabase } from '../supabaseClient';

export class ConsentService {
  /**
   * Grants new consent. Append-only.
   */
  static async grantConsent(patientId: string, actorId: string, scope: string, grantedToFacilityId?: string, grantedToUserId?: string) {
    const { data, error } = await supabase
      .from('patient_consents')
      .insert({
        patient_id: patientId,
        actor_id: actorId,
        scope,
        granted_to_facility_id: grantedToFacilityId,
        granted_to_user_id: grantedToUserId,
        status: 'GRANTED'
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Revokes consent by appending a new REVOKED record. 
   * The historical GRANTED record is NEVER updated or deleted.
   */
  static async revokeConsent(patientId: string, actorId: string, scope: string, revokedFromFacilityId?: string) {
    const { data, error } = await supabase
      .from('patient_consents')
      .insert({
        patient_id: patientId,
        actor_id: actorId,
        scope,
        granted_to_facility_id: revokedFromFacilityId,
        status: 'REVOKED'
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
