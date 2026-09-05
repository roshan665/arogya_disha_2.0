import { supabase } from '../supabaseClient';

export interface SafetyAlert {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'ALLERGY' | 'INTERACTION' | 'DUPLICATE' | 'CONTRAINDICATION';
  message: string;
}

export class MedicationSafetyEngine {
  /**
   * Checks a proposed medication against the patient's history.
   * This is a deterministic mock for what would ideally be an integration with SNOMED CT / RxNorm.
   */
  static checkSafety(patientAllergies: string[], proposedMedicine: string): SafetyAlert[] {
    const alerts: SafetyAlert[] = [];

    // Mock Allergy Check
    const medLower = proposedMedicine.toLowerCase();
    if (patientAllergies.some(a => medLower.includes(a.toLowerCase()))) {
      alerts.push({
        severity: 'HIGH',
        type: 'ALLERGY',
        message: `Patient has a known allergy to components in ${proposedMedicine}.`
      });
    }

    // Mock Interaction (e.g. Warfarin + Aspirin)
    // Real implementation would check against patient's active prescriptions
    if (medLower.includes('aspirin') && patientAllergies.includes('warfarin_active')) {
       alerts.push({
        severity: 'HIGH',
        type: 'INTERACTION',
        message: `SEVERE INTERACTION: Aspirin increases bleeding risk when taken with Warfarin.`
      });
    }

    return alerts;
  }

  /**
   * If a doctor chooses to prescribe despite a HIGH severity alert, they MUST log an override.
   */
  static async logSafetyOverride(prescriptionItemId: string, doctorId: string, alertType: string, reason: string) {
    if (!reason || reason.trim().length < 10) {
      throw new Error("VALIDATION_ERROR: A detailed override reason is required to bypass a safety alert.");
    }

    const { data, error } = await supabase
      .from('medication_safety_overrides')
      .insert({
        prescription_item_id: prescriptionItemId,
        doctor_id: doctorId,
        alert_type: alertType,
        override_reason: reason
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
