import { DuplicateDetectionService } from '../../lib/services/DuplicateDetectionService';
import { supabase } from '../../lib/supabaseClient';

// Mock supabase client
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('DuplicateDetectionService', () => {
  const mockPatient = {
    first_name: 'Rahul',
    last_name: 'Sharma',
    date_of_birth: '1990-01-01',
    address: '123 Main St',
    village: 'Kondhwa',
    district: 'Pune'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns HIGH confidence when identifier matches exactly', async () => {
    const mockFrom = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [{ patient_id: '123' }], error: null })
    };
    (supabase.from as jest.Mock).mockReturnValue(mockFrom);

    const result = await DuplicateDetectionService.checkDuplicate(mockPatient, [{ type: 'Aadhaar', value: '123456789012' }]);
    expect(result).toBe('HIGH');
  });

  it('returns UNCERTAIN confidence when name and village match but no identifiers', async () => {
    const mockFrom = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [], error: null }), // No identifier match
      ilike: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }) // No DOB match
    };
    
    // For the 3rd query (Village match)
    const softMatchFrom = {
      select: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockResolvedValue({ data: [{ id: '123' }], error: null })
    };

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(mockFrom) // 1. Identifier
      .mockReturnValueOnce(mockFrom) // 2. DOB
      .mockReturnValueOnce(softMatchFrom); // 3. Village

    const result = await DuplicateDetectionService.checkDuplicate(mockPatient, []);
    expect(result).toBe('UNCERTAIN');
  });

  it('returns NONE when no matches are found', async () => {
    const mockFrom = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
      ilike: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null })
    };

    (supabase.from as jest.Mock).mockReturnValue(mockFrom);

    const result = await DuplicateDetectionService.checkDuplicate(mockPatient, []);
    expect(result).toBe('NONE');
  });
});
