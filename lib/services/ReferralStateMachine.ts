import { ReferralRepository } from '../repositories/ReferralRepository';
import { NotificationService } from './NotificationService';

export class ReferralStateMachine {
  // Valid transitions mapping
  private static VALID_TRANSITIONS: Record<string, string[]> = {
    'draft': ['submitted', 'cancelled'],
    'submitted': ['pending_acceptance', 'cancelled'],
    'pending_acceptance': ['accepted', 'rejected', 'cancelled'],
    'accepted': ['scheduled', 'checked_in', 'cancelled'],
    'scheduled': ['checked_in', 'cancelled', 'expired'],
    'checked_in': ['in_consultation', 'cancelled'],
    'in_consultation': ['completed', 'transferred'],
    'rejected': ['transferred'], // Can transfer to a new facility after rejection
    'completed': [],
    'cancelled': [],
    'expired': [],
    'transferred': []
  };

  /**
   * Attempts to transition a referral to a new state securely.
   */
  static async transition(
    referralId: string, 
    currentState: string, 
    newState: string, 
    actorId: string,
    additionalData: any = {}
  ) {
    // 1. Validate State Jump
    const allowedNextStates = this.VALID_TRANSITIONS[currentState.toLowerCase()];
    
    if (!allowedNextStates || !allowedNextStates.includes(newState.toLowerCase())) {
      throw new Error(`INVALID_TRANSITION: Cannot transition referral from '${currentState}' to '${newState}'.`);
    }

    // 2. Validate Contextual Rules
    if (newState.toLowerCase() === 'rejected' && !additionalData.rejection_reason) {
      throw new Error(`VALIDATION_ERROR: A rejection_reason is strictly required to reject a referral.`);
    }

    // 3. Commit Transition
    const result = await ReferralRepository.updateReferralState(referralId, newState.toLowerCase(), actorId, additionalData);

    // 4. Domain Event -> Realtime Notification & Role-Based Realtime Event Fanout
    if (newState.toLowerCase() === 'accepted' || newState.toLowerCase() === 'rejected') {
      const referringUserId = result.referring_user_id; 
      
      if (referringUserId) {
        await NotificationService.publishEvent({
          userId: referringUserId,
          title: `Referral ${newState.toUpperCase()}`,
          message: `Your referral for patient ${result.patient_id} was ${newState}.`,
          type: `REFERRAL_${newState.toUpperCase()}`,
          entityId: referralId,
          entityType: 'referral'
        });
      }
    }

    // 5. Structured Minimal Realtime Event Fanout (Respecting Role Scopes & No Medical Data Leakage)
    try {
      const { RealtimeCommunicationService } = await import('./RealtimeCommunicationService');
      await RealtimeCommunicationService.fanoutEvent(
        {
          type: `REFERRAL_${newState.toUpperCase()}`,
          actorId: actorId,
          actorRole: 'PHC',
          patientId: result.patient_id || 'p-patient-101',
          relatedEntityId: referralId,
          relatedEntityType: 'referral',
        },
        [
          { recipientType: 'DISTRICT_HOSPITAL', recipientFacilityId: result.destination_facility_id },
          { recipientType: 'PHC', recipientFacilityId: result.source_facility_id, recipientUserId: result.referring_user_id },
          { recipientType: 'ASHA' },
          { recipientType: 'PATIENT', recipientUserId: result.patient_id }
        ]
      );
    } catch (e) {
      console.warn('Realtime event fanout suppressed:', e);
    }

    return result;
  }
}
