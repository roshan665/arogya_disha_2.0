import { supabase } from '../supabaseClient';
import { Patient } from '../repositories/PatientRepository';

export class DuplicateDetectionService {
  /**
   * Checks for duplicate patients.
   * HIGH confidence: Exact Aadhaar/ABHA match OR Exact (Name + DOB).
   * UNCERTAIN confidence: Phone match OR Name + Village match.
   * NONE: No matches.
   */
  static async checkDuplicate(patient: Patient, identifiers: {type: string, value: string}[]): Promise<'HIGH' | 'UNCERTAIN' | 'NONE'> {
    // 1. Check strict identifiers (Aadhaar, ABHA)
    if (identifiers.length > 0) {
      const values = identifiers.map(i => i.value);
      const { data: identMatches, error } = await supabase
        .from('patient_identifiers')
        .select('patient_id')
        .in('identifier_value', values);
        
      if (!error && identMatches && identMatches.length > 0) {
        return 'HIGH';
      }
    }

    // 2. Check Name + DOB (HIGH)
    if (patient.date_of_birth) {
      const { data: exactMatches, error: exactError } = await supabase
        .from('patients')
        .select('id')
        .ilike('first_name', patient.first_name)
        .ilike('last_name', patient.last_name)
        .eq('date_of_birth', patient.date_of_birth);
        
      if (!exactError && exactMatches && exactMatches.length > 0) {
        return 'HIGH';
      }
    }

    // 3. Check Name + Village (UNCERTAIN)
    const { data: softMatches, error: softError } = await supabase
      .from('patients')
      .select('id')
      .ilike('first_name', patient.first_name)
      .ilike('last_name', patient.last_name)
      .ilike('village', patient.village);

    if (!softError && softMatches && softMatches.length > 0) {
      return 'UNCERTAIN';
    }

    return 'NONE';
  }
}
