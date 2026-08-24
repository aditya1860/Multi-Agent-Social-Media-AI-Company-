# System Design: Vitalis Clinical Appointment & Follow-up Manager

## 1. Double-Booking Prevention

### The Problem
In a concurrent web system, two patients can simultaneously request the same time slot. If the application checks slot availability and then creates the booking as two separate operations, a race condition allows both to succeed — producing a double-booking that's harmful in a clinical context.

### The Solution: DB Unique Constraint + Serializable Transaction

**Layer 1 — Database unique constraint (permanent guarantee):**
```sql
-- Enforced by Prisma: @@unique([doctorId, slotStart])
CREATE UNIQUE INDEX ON appointments (doctor_id, slot_start);
```
This constraint means the database will **physically reject** any second INSERT for the same `(doctorId, slotStart)` pair, regardless of what the application layer does. No amount of concurrent requests can bypass this — it's enforced at the storage engine level.

**Layer 2 — Serializable transaction (concurrent check protection):**
```typescript
await prisma.$transaction(async (tx) => {
  // Check for active booking
  const existing = await tx.appointment.findFirst({ where: { doctorId, slotStart, status: ['HELD', 'CONFIRMED'] } });
  if (existing) throw new Error('SLOT_TAKEN');
  // Create the hold
  return tx.appointment.create({ data: { status: 'HELD', holdExpiresAt, ... } });
}, { isolationLevel: 'Serializable' });
```
`Serializable` isolation means each transaction sees a consistent snapshot; two concurrent transactions reading the same slot both see "available," but only one INSERT can succeed — the second gets a `P2002` unique constraint violation, which we catch and convert to a friendly 409 response: *"This slot was just taken. Please pick another time."*

**Why both layers?** The transaction check handles the happy path clearly. The constraint is the iron-clad fallback that catches any edge case the transaction might miss (e.g., a bug in the application check, or a replica lag issue).

---

## 2. Slot Hold Mechanism

### The Problem
A patient selects a slot and begins filling the symptom form (a multi-minute process). Without a hold, another patient can book the same slot while the first patient is still filling the form, causing a booking failure at the worst moment — right after the patient spent 5 minutes writing their symptoms.

### The Solution: TTL-Based Hold Row

When a patient clicks a time slot, the `/appointments/hold` endpoint:
1. Creates an `Appointment` row with `status = HELD` and `holdExpiresAt = now + 5 minutes`
2. Returns the appointment ID immediately

The slot is now effectively "reserved" — the unique constraint blocks other bookings for the same `(doctorId, slotStart)`. When computing available slots, expired holds (`holdExpiresAt < now`) are treated as available. Active holds are treated as unavailable.

**Expiry:** A background sweeper runs every 2 minutes via `node-cron`:
```typescript
await prisma.appointment.updateMany({
  where: { status: 'HELD', holdExpiresAt: { lt: new Date() } },
  data: { status: 'CANCELLED' },
});
```

**Flow:** Hold (5-min TTL) → Patient fills symptom form → Confirm (slot locked permanently as CONFIRMED, hold expires cleared). If patient abandons, the hold expires automatically and the slot is released within 2 minutes.

---

## 3. Doctor Leave Conflict Handling

### The Problem
An admin marks a doctor as unavailable on a date that already has confirmed patient appointments. If this is handled naively, patients show up expecting their appointment but find the clinic closed.

### The Solution: Reconciliation on Leave Creation

When admin calls `POST /api/admin/leave`, two things happen:
1. The leave row is created immediately (`DoctorLeave.date` has a unique constraint on `[doctorId, date]`)
2. A reconciliation function runs asynchronously:

```typescript
async function reconcileLeaveConflicts(doctorId: string, leaveDate: Date) {
  const affected = await prisma.appointment.findMany({
    where: { doctorId, slotStart: { gte: startOfDay, lte: endOfDay }, status: 'CONFIRMED' }
  });
  for (const apt of affected) {
    await prisma.appointment.update({ where: { id: apt.id }, data: { status: 'RESCHEDULED' } });
    // Fire-and-forget notification (writes NotificationLog first)
    sendNotification({ type: 'RESCHEDULE', ... });
  }
}
```

Appointments are marked `RESCHEDULED` (they remain visible in history), and patients receive an email explaining the situation and asking them to book a new slot. The reconciliation is kicked off as a background promise — it never blocks the admin's HTTP response. Any notification failures are written to `NotificationLog` and retried by the retry job.

**Permission model:** Doctors may submit leave *requests* visible to admins. Only admins create the authoritative `DoctorLeave` record that affects slot availability. This prevents doctors from retroactively cancelling appointments without oversight.

---

## 4. Notification Failure Handling

### The Problem
Email and calendar APIs can fail transiently (network issues, SMTP rate limits, API downtime). A naive implementation that throws an error when email fails would either block the booking response or silently drop the notification.

### The Solution: Log-Then-Send with Async Retry

**Invariant:** Every notification attempt creates a `NotificationLog` row with `status = PENDING` *before* the send is attempted. This means even if the process crashes mid-send, the log exists and the retry job will pick it up.

```typescript
// 1. Create PENDING log (always succeeds)
const log = await prisma.notificationLog.create({
  data: { appointmentId, channel, type, status: 'PENDING' }
});

// 2. Attempt send (may fail)
const result = await sendEmail(opts);  // try/catch

// 3. Update log status
await prisma.notificationLog.update({
  where: { id: log.id },
  data: {
    status: result.success ? 'SENT' : 'FAILED',
    attempts: 1,
    errorMessage: result.error || null,
  }
});
```

**Booking independence:** `sendNotification()` is always called with `.catch(() => {})` — it runs fire-and-forget from the booking endpoint. A failed email never produces a 500 to the user.

**Retry with exponential backoff:** The `notification-retry` cron job runs every 5 minutes:
```typescript
const backoffMs = Math.pow(2, log.attempts) * 60_000;  // 1m, 2m, 4m...
if (Date.now() - log.lastAttemptAt < backoffMs) continue;  // skip if too soon
```

After `MAX_NOTIFICATION_RETRIES` attempts (default: 3), the log is set to `ABANDONED` and surfaced in the Admin → Notification Log view, where staff can take manual action.

**Admin visibility:** The notification log table shows every attempt, status, and error message, giving operations staff full observability into delivery failures without any alert fatigue from transient errors.
