import { SyncEngine, SyncPayload } from '../../lib/services/SyncEngine';
import { supabase } from '../../lib/supabaseClient';

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('Security & Penetration: MVCC Conflict Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects clinical sync payloads if the client version is older than the server (MVCC Conflict)', async () => {
    // Mock the Idempotency Check (returns null = not processed)
    const mockIdempotencyCheck = jest.fn().mockReturnValue({ single: () => Promise.resolve({ data: null }) });
    
    // Mock the Server State Fetch (Server is at Version 5)
    const mockServerFetch = jest.fn().mockReturnValue({ 
        eq: () => ({ single: () => Promise.resolve({ data: { id: 'patient-1', version: 5 }, error: null }) }) 
    });

    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'sync_queue_logs') return { select: () => ({ eq: mockIdempotencyCheck }) };
      if (table === 'patients') return { select: () => mockServerFetch() };
    });

    const maliciousPayload: SyncPayload = {
      transactionId: 'txn-999',
      entityType: 'patient',
      entityId: 'patient-1',
      clientVersion: 3, // Client is 2 versions behind
      data: { blood_pressure: '120/80' },
      actorId: 'asha-1'
    };

    const result = await SyncEngine.processSyncPayload(maliciousPayload);

    // It MUST reject it with a 409 Conflict, rather than letting Last-Write-Wins overwrite the server
    expect(result.status).toBe('409_CONFLICT');
    expect(result.message).toContain('Manual resolution required');
  });

  it('maintains absolute idempotency (ignores replays of the same transaction_id)', async () => {
    // Mock Idempotency Check (returns existing record = already processed)
    const mockIdempotencyCheck = jest.fn().mockReturnValue({ single: () => Promise.resolve({ data: { transaction_id: 'txn-123' } }) });
    
    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'sync_queue_logs') return { select: () => ({ eq: mockIdempotencyCheck }) };
    });

    const payload: SyncPayload = {
      transactionId: 'txn-123',
      entityType: 'patient',
      entityId: 'patient-1',
      clientVersion: 5,
      data: { notes: 'Replayed data' },
      actorId: 'asha-1'
    };

    const result = await SyncEngine.processSyncPayload(payload);

    expect(result.status).toBe('ALREADY_PROCESSED');
  });
});
