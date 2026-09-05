import { NotificationService } from '../../lib/services/NotificationService';
import { supabase } from '../../lib/supabaseClient';

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes domain events to the notifications table securely', async () => {
    const mockInsert = jest.fn().mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'notif-1' }, error: null }) }) });
    (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

    const payload = {
      userId: 'doc-123',
      title: 'Lab Ready',
      message: 'Result is verified.',
      type: 'DIAGNOSTIC_RESULT_AVAILABLE',
      entityId: 'diag-456',
      entityType: 'diagnostic'
    };

    const result = await NotificationService.publishEvent(payload);

    expect(result.id).toBe('notif-1');
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: payload.userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      entity_id: payload.entityId,
      entity_type: payload.entityType
    });
  });

  it('throws an error if publish fails', async () => {
    const mockInsert = jest.fn().mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'RLS violation' } }) }) });
    (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

    await expect(NotificationService.publishEvent({
      userId: 'doc-123',
      title: 'Lab Ready',
      message: 'Result is verified.',
      type: 'DIAGNOSTIC_RESULT_AVAILABLE',
      entityId: 'diag-456',
      entityType: 'diagnostic'
    })).rejects.toThrow('RLS violation');
  });
});
