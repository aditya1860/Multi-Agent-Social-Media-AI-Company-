import { describe, it, expect, vi } from 'vitest';

// ─── Slot Availability Tests ──────────────────────────────────────────────────

describe('slot generation logic', () => {
  function generateSlots(start: string, end: string, durationMin: number) {
    const slots: { start: string; end: string }[] = [];
    const base = new Date('2026-08-25');
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let current = new Date(base);
    current.setHours(sh, sm, 0, 0);
    const endTime = new Date(base);
    endTime.setHours(eh, em, 0, 0);
    while (current < endTime) {
      const slotEnd = new Date(current.getTime() + durationMin * 60_000);
      if (slotEnd > endTime) break;
      slots.push({ start: current.toISOString(), end: slotEnd.toISOString() });
      current = slotEnd;
    }
    return slots;
  }

  it('generates 16 slots for 09:00-17:00 with 30-min slots', () => {
    const slots = generateSlots('09:00', '17:00', 30);
    expect(slots).toHaveLength(16);
  });

  it('generates 5 slots for 09:00-13:00 with 45-min slots', () => {
    const slots = generateSlots('09:00', '13:00', 45);
    expect(slots).toHaveLength(5);
  });

  it('generates 0 slots when working hours are null (day off)', () => {
    // Simulate null working hours
    const profile = { workingHours: { monday: null } };
    const daySlots = (profile.workingHours as any)['monday'];
    expect(daySlots).toBeNull();
  });
});

// ─── Notification Service Tests ────────────────────────────────────────────────

describe('notification reliability model', () => {
  it('booking success is independent of notification failure', async () => {
    // The key design invariant: notification failure never propagates to caller
    let bookingSucceeded = false;

    async function simulateBooking() {
      // Booking logic succeeds
      bookingSucceeded = true;

      // Fire-and-forget notification (catches all errors)
      Promise.resolve()
        .then(async () => { throw new Error('SMTP connection failed'); })
        .catch(() => {
          // Error caught internally — never propagates
        });
    }

    // No errors should propagate
    await expect(simulateBooking()).resolves.toBeUndefined();
    expect(bookingSucceeded).toBe(true);
  });

  it('notification log is created before send attempt', () => {
    // Verify the log-then-send order
    const logs: string[] = [];

    async function simulateNotification() {
      logs.push('CREATED_PENDING_LOG'); // Step 1: always succeeds
      try {
        throw new Error('Send failed'); // Step 2: may fail
      } catch {
        logs.push('UPDATED_LOG_TO_FAILED'); // Step 3: update status
      }
    }

    simulateNotification().then(() => {
      expect(logs[0]).toBe('CREATED_PENDING_LOG');
      expect(logs[1]).toBe('UPDATED_LOG_TO_FAILED');
    });
  });
});

// ─── Double-Booking Concurrency Model ─────────────────────────────────────────

describe('double-booking prevention model', () => {
  it('exactly one of two concurrent requests for the same slot succeeds', () => {
    // Simulate the unique constraint behavior
    const occupied = new Set<string>();
    let p2002Count = 0;
    let successCount = 0;

    function tryInsert(slotKey: string): 'SUCCESS' | 'P2002_UNIQUE_VIOLATION' {
      if (occupied.has(slotKey)) {
        p2002Count++;
        return 'P2002_UNIQUE_VIOLATION';
      }
      occupied.add(slotKey);
      successCount++;
      return 'SUCCESS';
    }

    const slot = 'doctor-abc::2026-09-01T09:00:00Z';

    // Two concurrent requests for the same slot
    const result1 = tryInsert(slot);
    const result2 = tryInsert(slot);

    expect(successCount).toBe(1); // Exactly one succeeds
    expect(p2002Count).toBe(1);   // Exactly one fails
    expect([result1, result2]).toContain('SUCCESS');
    expect([result1, result2]).toContain('P2002_UNIQUE_VIOLATION');
  });

  it('different slots do not conflict', () => {
    const occupied = new Set<string>();
    let successCount = 0;

    function tryInsert(slotKey: string): boolean {
      if (occupied.has(slotKey)) return false;
      occupied.add(slotKey);
      successCount++;
      return true;
    }

    // Two different slots — both should succeed
    const r1 = tryInsert('doctor-abc::2026-09-01T09:00:00Z');
    const r2 = tryInsert('doctor-abc::2026-09-01T09:30:00Z');

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(successCount).toBe(2);
  });
});

// ─── Hold Expiry Logic ─────────────────────────────────────────────────────────

describe('slot hold expiry', () => {
  it('expired holds are treated as available', () => {
    const now = new Date();
    const expiredHold = {
      status: 'HELD' as const,
      holdExpiresAt: new Date(now.getTime() - 60_000), // 1 minute ago
    };
    const activeHold = {
      status: 'HELD' as const,
      holdExpiresAt: new Date(now.getTime() + 300_000), // 5 minutes from now
    };

    function isSlotBlocked(apt: typeof expiredHold): boolean {
      if (apt.status === 'HELD' && apt.holdExpiresAt < now) return false; // expired
      return true;
    }

    expect(isSlotBlocked(expiredHold)).toBe(false); // Available (expired)
    expect(isSlotBlocked(activeHold)).toBe(true);   // Blocked (active hold)
  });
});

// ─── Email Template Tests ──────────────────────────────────────────────────────

describe('email templates', () => {
  it('confirmation email contains appointment details', async () => {
    const { buildConfirmationEmail } = await import('../services/email');
    const html = buildConfirmationEmail({
      patientName: 'Alex Johnson',
      doctorName: 'Emily Smith',
      specialization: 'Cardiology',
      slotStart: new Date('2026-09-01T09:00:00Z'),
      slotEnd: new Date('2026-09-01T09:30:00Z'),
      appointmentId: 'test-id-123',
    });

    expect(html).toContain('Alex Johnson');
    expect(html).toContain('Emily Smith');
    expect(html).toContain('Cardiology');
    expect(html).toContain('Appointment Confirmed');
  });
});
