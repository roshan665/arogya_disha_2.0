import { AshaClinicalService } from '../../lib/services/AshaClinicalService';
import { AshaWorkflowRepository } from '../../lib/repositories/AshaWorkflowRepository';
import { AIServiceClient } from '../../lib/services/AIServiceClient';
import { supabase } from '../../lib/supabaseClient';

jest.mock('../../lib/repositories/AshaWorkflowRepository');
jest.mock('../../lib/services/AIServiceClient');
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null })
  }
}));

describe('AshaClinicalService & Rule Engine', () => {
  const visitData: any = {
    patient_id: 'pat-1',
    asha_id: 'asha-1',
    symptoms: [],
    vitals: { temperature: 98.6 },
    risk_score: 'GREEN',
    notes: ''
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (AshaWorkflowRepository.logVisit as jest.Mock).mockResolvedValue({ id: 'visit-123' });
    (AshaWorkflowRepository.scheduleFollowUp as jest.Mock).mockResolvedValue(true);
  });

  it('AI cannot downgrade a URGENT/CRITICAL rule engine decision', async () => {
    // 1. Context gives severe symptoms -> Rule Engine will return CRITICAL
    const severeContext = { ...visitData, symptoms: ['chest_pain'] };
    
    // 2. Mock AI trying to downplay it to GREEN
    (AIServiceClient.getRecommendation as jest.Mock).mockResolvedValue({
      recommendation: 'GREEN',
      reason: 'AI thinks it is fine.',
      is_fallback: false
    });

    const result = await AshaClinicalService.completeCheckup(severeContext, false);

    // 3. Final system decision must remain CRITICAL (AI cannot override safety rule)
    expect(result.systemRecommendation).toBe('CRITICAL');
  });

  it('AI can escalate a GREEN rule engine decision', async () => {
    // 1. Context gives no symptoms -> Rule Engine returns GREEN
    const normalContext = { ...visitData };
    
    // 2. Mock AI catching something subtle and escalating to YELLOW
    (AIServiceClient.getRecommendation as jest.Mock).mockResolvedValue({
      recommendation: 'YELLOW',
      reason: 'AI detected a pattern.',
      is_fallback: false
    });

    const result = await AshaClinicalService.completeCheckup(normalContext, false);

    // 3. Final system decision is escalated to YELLOW
    expect(result.systemRecommendation).toBe('YELLOW');
  });

  it('Logs override correctly when ASHA overrides system decision', async () => {
    // 1. Normal context -> Rule GREEN
    const normalContext = { ...visitData, risk_score: 'YELLOW' }; // Asha manually selecting YELLOW
    
    // 2. AI agrees it's GREEN
    (AIServiceClient.getRecommendation as jest.Mock).mockResolvedValue({
      recommendation: 'GREEN',
      is_fallback: false
    });

    // 3. Complete checkup WITH override reason
    await AshaClinicalService.completeCheckup(normalContext, false, "Patient looks very pale, overriding to YELLOW");

    // 4. Verify AI audit log captured the override
    expect(supabase.from).toHaveBeenCalledWith('ai_audit_logs');
    expect((supabase.from as any)().insert).toHaveBeenCalledWith(
      expect.objectContaining({
        is_overridden: true,
        override_reason: "Patient looks very pale, overriding to YELLOW",
        final_decision: 'YELLOW',
        rule_recommendation: 'GREEN',
        ai_recommendation: 'GREEN'
      })
    );
  });
});
