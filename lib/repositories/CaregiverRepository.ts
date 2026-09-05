import { supabase } from '../supabaseClient';

export class CaregiverRepository {
  static async addCaregiver(patientId: string, caregiverId: string, relationship: string, permissions: string[]) {
    const { data: caregiver, error } = await supabase
      .from('caregivers')
      .insert({ patient_id: patientId, caregiver_id: caregiverId, relationship })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const permissionInserts = permissions.map(p => ({
      caregiver_id: caregiver.id,
      permission: p
    }));

    const { error: permError } = await supabase
      .from('caregiver_permissions')
      .insert(permissionInserts);

    if (permError) throw new Error(permError.message);
    return caregiver;
  }

  static async revokeCaregiver(caregiverId: string) {
    // Simply delete the caregiver assignment. Due to ON DELETE CASCADE, permissions will drop.
    // Alternatively, we could set an expiry date.
    const { error } = await supabase
      .from('caregivers')
      .delete()
      .eq('id', caregiverId);

    if (error) throw new Error(error.message);
    return true;
  }

  static async getCaregiversForPatient(patientId: string) {
    const { data, error } = await supabase
      .from('caregivers')
      .select(`
        *,
        caregiver_permissions (permission)
      `)
      .eq('patient_id', patientId);

    if (error) throw new Error(error.message);
    return data;
  }
}
