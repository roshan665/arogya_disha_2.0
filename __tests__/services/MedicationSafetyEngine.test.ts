import { MedicationSafetyEngine } from '../../lib/services/MedicationSafetyEngine';
import { supabase } from '../../lib/supabaseClient';

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('MedicationSafetyEngine', () => {
  it('detects allergies deterministically', () => {
    const alerts = MedicationSafetyEngine.checkSafety(['penicillin'], 'Amoxicillin (Penicillin-based)');
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('ALLERGY');
    expect(alerts[0].severity).toBe('HIGH');
  });

  it('detects severe drug interactions (e.g. Warfarin + Aspirin)', () => {
    const alerts = MedicationSafetyEngine.checkSafety(['warfarin_active'], 'Aspirin 81mg');
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('INTERACTION');
    expect(alerts[0].severity).toBe('HIGH');
  });

  it('blocks safety overrides without a detailed reason', async () => {
    await expect(MedicationSafetyEngine.logSafetyOverride('item-1', 'doc-1', 'INTERACTION', 'ok'))
      .rejects
      .toThrow('VALIDATION_ERROR: A detailed override reason is required to bypass a safety alert.');
  });
});
