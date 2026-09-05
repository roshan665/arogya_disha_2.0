import { ConsultationService } from '../../lib/services/ConsultationService';
import { supabase } from '../../lib/supabaseClient';

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('ConsultationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks completion if required fields are missing', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { status: 'IN_PROGRESS', assessment: null }, error: null }) }) })
    });

    await expect(ConsultationService.completeConsultation('consult-1', 'doc-1'))
      .rejects
      .toThrow('CLINICAL_VALIDATION_ERROR: Cannot complete consultation. Missing required fields: Assessment, Treatment Plan, Outcome.');
  });

  it('allows completion if override reason is provided for missing fields', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    const mockUpdate = jest.fn().mockReturnValue({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { status: 'COMPLETED' }, error: null }) }) }) });

    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'consultations') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { status: 'IN_PROGRESS', assessment: null }, error: null }) }) }),
          update: mockUpdate
        };
      }
      if (table === 'audit_logs') {
        return { insert: mockInsert };
      }
    });

    const result = await ConsultationService.completeConsultation('consult-1', 'doc-1', 'Patient left against medical advice');
    expect(result.status).toBe('COMPLETED');
    expect(mockInsert).toHaveBeenCalled(); // Ensure audit log was written
  });
});
