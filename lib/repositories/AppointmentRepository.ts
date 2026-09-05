import { supabase } from '../supabaseClient';

export interface Appointment {
  id: string;
  slot_id: string;
  patient_id: string;
  status: string;
  booked_by: string;
  token_number?: number;
  priority_score?: number;
  priority_reason?: string;
}

export class AppointmentRepository {
  /**
   * Safely books a slot. Relies entirely on PostgreSQL `idx_appointments_unique_slot` 
   * to guarantee no double-bookings under extreme concurrency.
   */
  static async bookAppointment(slotId: string, patientId: string, bookedBy: string): Promise<Appointment> {
    // Attempt the insert. If someone else booked it, Postgres throws a unique_violation (23505)
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        slot_id: slotId,
        patient_id: patientId,
        booked_by: bookedBy,
        status: 'BOOKED'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('SLOT_TAKEN: This appointment slot was just booked by someone else.');
      }
      throw new Error(`Booking failed: ${error.message}`);
    }

    // Update slot status (Optimistic update, not strictly required due to index, but good for UI)
    await supabase.from('appointment_slots').update({ status: 'BOOKED' }).eq('id', slotId);

    // Audit Log
    await supabase.from('audit_logs').insert({
      actor_id: bookedBy,
      entity_type: 'appointment',
      entity_id: data.id,
      action: 'BOOK',
      after_state: data
    });

    return data as Appointment;
  }

  static async updateStatus(appointmentId: string, status: string, actorId: string, additionalFields: any = {}): Promise<Appointment> {
    const { data: beforeState, error: fetchErr } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const { data, error } = await supabase
      .from('appointments')
      .update({ status, updated_at: new Date().toISOString(), ...additionalFields })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      entity_type: 'appointment',
      entity_id: appointmentId,
      action: `STATUS_CHANGE_${status}`,
      before_state: beforeState,
      after_state: data
    });

    return data as Appointment;
  }
}
