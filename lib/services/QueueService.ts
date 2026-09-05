import { AppointmentStateMachine } from './AppointmentStateMachine';
import { supabase } from '../supabaseClient';

export class QueueService {
  /**
   * Hospital Staff verifies the patient, assigns a token, and moves them to IN_QUEUE
   */
  static async checkInPatient(appointmentId: string, staffId: string, referralUrgency?: string) {
    // 1. Calculate Priority Score
    // Base 10. Urgent referrals get huge boosts.
    let score = 10;
    let reason = "Standard check-in";

    if (referralUrgency === 'RED' || referralUrgency === 'CRITICAL') {
      score = 100;
      reason = "Urgent clinical priority";
    } else if (referralUrgency === 'YELLOW') {
      score = 50;
      reason = "Moderate risk priority";
    }

    // 2. Generate a daily token (mocked logic for simplicity, normally read sequence)
    const tokenNumber = Math.floor(Math.random() * 1000) + 1;

    // 3. First transition to CHECKED_IN, then immediately IN_QUEUE
    await AppointmentStateMachine.transition(appointmentId, 'CONFIRMED', 'CHECKED_IN', staffId);
    
    const queuedAppt = await AppointmentStateMachine.transition(appointmentId, 'CHECKED_IN', 'IN_QUEUE', staffId, {
      token_number: tokenNumber,
      priority_score: score,
      priority_reason: reason
    });

    return queuedAppt;
  }

  /**
   * Fetches the dynamic queue sorted natively by the database index.
   * Sorting: Status (IN_QUEUE first), then Priority Score (DESC), then Wait Time (created_at ASC)
   */
  static async getLiveQueue(facilityId: string, doctorId?: string) {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        patients(first_name, last_name, village),
        appointment_slots!inner(facility_id, doctor_id, start_time)
      `)
      .in('status', ['IN_QUEUE', 'IN_CONSULTATION'])
      .eq('appointment_slots.facility_id', facilityId);

    if (doctorId) {
      query = query.eq('appointment_slots.doctor_id', doctorId);
    }

    // Relying on the idx_appointments_queue index natively
    query = query.order('status', { ascending: false }) // IN_QUEUE before IN_CONSULTATION usually handled differently in UI, but this groups them
                 .order('priority_score', { ascending: false }) // Urgency first
                 .order('created_at', { ascending: true });     // FIFO for identical urgencies

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }
}
