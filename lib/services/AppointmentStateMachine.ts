import { AppointmentRepository } from '../repositories/AppointmentRepository';
import { NotificationService } from './NotificationService';

export class AppointmentStateMachine {
  private static VALID_TRANSITIONS: Record<string, string[]> = {
    'BOOKED': ['CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW'],
    'CONFIRMED': ['CHECKED_IN', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW'],
    'CHECKED_IN': ['IN_QUEUE', 'CANCELLED'],
    'IN_QUEUE': ['IN_CONSULTATION', 'CANCELLED'],
    'IN_CONSULTATION': ['COMPLETED', 'IN_QUEUE'], // Can send back to queue if interrupted
    'COMPLETED': [],
    'CANCELLED': [],
    'RESCHEDULED': [],
    'NO_SHOW': []
  };

  static async transition(appointmentId: string, currentState: string, newState: string, actorId: string, additionalFields: any = {}) {
    const allowed = this.VALID_TRANSITIONS[currentState];
    if (!allowed || !allowed.includes(newState)) {
      throw new Error(`INVALID_TRANSITION: Cannot transition appointment from '${currentState}' to '${newState}'.`);
    }

    const result = await AppointmentRepository.updateStatus(appointmentId, newState, actorId, additionalFields);

    // Domain Event -> Realtime Notification
    if (newState === 'CHECKED_IN') {
      if (additionalFields.doctor_id) {
        await NotificationService.publishEvent({
          userId: additionalFields.doctor_id,
          title: 'Patient Arrived',
          message: `A patient has checked in for their appointment.`,
          type: 'PATIENT_CHECKED_IN',
          entityId: appointmentId,
          entityType: 'appointment'
        });
      }
    }

    // Role-Based Realtime Event Fanout (Minimal, Secure)
    try {
      const { RealtimeCommunicationService } = await import('./RealtimeCommunicationService');
      await RealtimeCommunicationService.fanoutEvent(
        {
          type: `APPOINTMENT_${newState}`,
          actorId: actorId,
          actorRole: additionalFields.actorRole || 'PHC',
          patientId: result?.patient_id || 'p-patient-101',
          relatedEntityId: appointmentId,
          relatedEntityType: 'appointment',
        },
        [
          { recipientType: 'PATIENT', recipientUserId: result?.patient_id },
          { recipientType: 'ASHA' },
          { recipientType: 'PHC', recipientFacilityId: additionalFields.facility_id }
        ]
      );
    } catch (e) {
      console.warn('Appointment realtime event fanout suppressed:', e);
    }

    return result;
  }
}
