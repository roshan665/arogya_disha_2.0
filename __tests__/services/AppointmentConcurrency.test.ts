import { AppointmentRepository } from '../../lib/repositories/AppointmentRepository';
import { supabase } from '../../lib/supabaseClient';

// Mocking Supabase heavily to simulate DB constraints
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('Appointment Booking Concurrency (Double Booking Prevention)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('guarantees only one booking succeeds when 10 concurrent requests target the same slot', async () => {
    const slotId = 'slot-concurrent-123';
    let bookingCount = 0;

    // Simulate the exact database behavior: The first insert succeeds, 
    // any simultaneous/subsequent inserts to the same slot hit the UNIQUE index constraint (code 23505).
    const mockInsert = jest.fn().mockImplementation(() => {
      if (bookingCount === 0) {
        bookingCount++;
        return { select: () => ({ single: () => Promise.resolve({ data: { id: 'appt-1', slot_id: slotId }, error: null }) }) };
      } else {
        return { select: () => ({ single: () => Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }) }) };
      }
    });

    (supabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert,
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    });

    // Fire 10 simultaneous booking requests
    const attempts = Array.from({ length: 10 }).map((_, i) => 
      AppointmentRepository.bookAppointment(slotId, `patient-${i}`, `actor-${i}`)
        .then(res => ({ success: true, res }))
        .catch(err => ({ success: false, err: err.message }))
    );

    const results = await Promise.all(attempts);

    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    // EXACTLY 1 must succeed, 9 must fail with SLOT_TAKEN
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(9);
    expect(failures[0].err).toBe('SLOT_TAKEN: This appointment slot was just booked by someone else.');
  });
});
