import { ReferralStateMachine } from '../../lib/services/ReferralStateMachine';
import { ReferralRepository } from '../../lib/repositories/ReferralRepository';

jest.mock('../../lib/repositories/ReferralRepository');

describe('ReferralStateMachine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows valid transitions (draft -> submitted)', async () => {
    (ReferralRepository.updateReferralState as jest.Mock).mockResolvedValue({ status: 'submitted' });

    const result = await ReferralStateMachine.transition('ref-1', 'draft', 'submitted', 'actor-1');
    expect(result.status).toBe('submitted');
    expect(ReferralRepository.updateReferralState).toHaveBeenCalledWith('ref-1', 'submitted', 'actor-1', {});
  });

  it('blocks invalid transitions (draft -> completed)', async () => {
    await expect(ReferralStateMachine.transition('ref-1', 'draft', 'completed', 'actor-1'))
      .rejects
      .toThrow("INVALID_TRANSITION: Cannot transition referral from 'draft' to 'completed'.");
  });

  it('blocks rejection without a reason', async () => {
    await expect(ReferralStateMachine.transition('ref-1', 'pending_acceptance', 'rejected', 'actor-1'))
      .rejects
      .toThrow("VALIDATION_ERROR: A rejection_reason is strictly required to reject a referral.");
  });

  it('allows rejection if reason is provided', async () => {
    (ReferralRepository.updateReferralState as jest.Mock).mockResolvedValue({ status: 'rejected' });

    const result = await ReferralStateMachine.transition('ref-1', 'pending_acceptance', 'rejected', 'actor-1', {
      rejection_reason: 'Facility full'
    });

    expect(result.status).toBe('rejected');
    expect(ReferralRepository.updateReferralState).toHaveBeenCalledWith('ref-1', 'rejected', 'actor-1', { rejection_reason: 'Facility full' });
  });
});
