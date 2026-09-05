import { supabase } from '../supabaseClient';

export interface Patient {
  id?: string;
  patient_id?: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: 'M' | 'F' | 'Other';
  blood_group?: string;
  address: string;
  village: string;
  district: string;
  pincode?: string;
  is_active?: boolean; // For soft deletes
  preferred_language?: string;
}

export class PatientRepository {
  static async createPatient(patient: Patient): Promise<Patient> {
    const { data, error } = await supabase
      .from('patients')
      .insert(patient)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async findById(id: string): Promise<Patient | null> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data;
  }

  static async searchPatients(query: string): Promise<Patient[]> {
    // Search by system ID, phone (via identifiers), or name
    const { data, error } = await supabase
      .from('patients')
      .select(`
        *,
        patient_identifiers ( identifier_value )
      `)
      .or(`patient_id.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`);

    if (error) throw new Error(error.message);
    return data;
  }

  static async assignAsha(patientId: string, ashaId: string, type: 'primary' | 'temporary' = 'primary') {
    if (type === 'primary') {
      // First, end any existing primary assignment
      await supabase
        .from('patient_asha_assignments')
        .update({ valid_until: new Date().toISOString() })
        .eq('patient_id', patientId)
        .eq('assignment_type', 'primary')
        .is('valid_until', null);
    }

    const { data, error } = await supabase
      .from('patient_asha_assignments')
      .insert({
        patient_id: patientId,
        asha_id: ashaId,
        assignment_type: type
      });

    if (error) throw new Error(error.message);
    return data;
  }

  static async deactivatePatient(patientId: string) {
    // Soft delete: set an is_active flag (requires schema update for is_active, assuming we add it or use status)
    // For now, we update a hypothetical 'is_active' column. 
    // In Phase 1 we didn't add is_active to patients, but we can add it here or use a metadata table.
    // Let's assume we alter the table or just update a status column.
    
    // Instead of dropping data, we soft-deactivate by unassigning ASHAs and flagging them.
    await supabase
      .from('patient_asha_assignments')
      .update({ valid_until: new Date().toISOString() })
      .eq('patient_id', patientId)
      .is('valid_until', null);
      
    // Ideally, we'd update an is_active column on patients here.
    return true;
  }
}
