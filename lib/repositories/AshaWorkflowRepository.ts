import { supabase } from '../supabaseClient';

export interface VisitData {
  patient_id: string;
  asha_id: string;
  symptoms: any;
  vitals: any;
  risk_score: 'GREEN' | 'YELLOW' | 'RED' | 'CRITICAL';
  notes: string;
}

export class AshaWorkflowRepository {
  /**
   * Fetches the ASHA's daily schedule (assigned patients with due/upcoming follow-ups or pending initial visits).
   */
  static async getSchedule(ashaId: string) {
    const { data, error } = await supabase
      .from('patient_asha_assignments')
      .select(`
        patient_id,
        assignment_type,
        patients (
          first_name, last_name, village,
          follow_ups (
            id, due_date, reason, status
          )
        )
      `)
      .eq('asha_id', ashaId)
      .is('valid_until', null);

    if (error) throw new Error(error.message);
    return data;
  }

  static async logVisit(visitData: VisitData) {
    const { data, error } = await supabase
      .from('asha_visits')
      .insert({
        patient_id: visitData.patient_id,
        asha_id: visitData.asha_id,
        symptoms: visitData.symptoms,
        vitals: visitData.vitals,
        risk_score: visitData.risk_score,
        notes: visitData.notes
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async scheduleFollowUp(patientId: string, dueDate: string, reason: string) {
    const { data, error } = await supabase
      .from('follow_ups')
      .insert({
        patient_id: patientId,
        due_date: dueDate,
        reason: reason,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async prepareReferral(patientId: string, ashaId: string, destinationFacilityId: string, urgency: string, reason: string) {
    const { data, error } = await supabase
      .from('referrals')
      .insert({
        patient_id: patientId,
        referring_user_id: ashaId,
        destination_facility_id: destinationFacilityId,
        urgency: urgency,
        reason: reason,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
