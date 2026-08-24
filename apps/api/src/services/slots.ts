import { prisma } from '../config/db';

interface WorkingHours {
  [day: string]: { start: string; end: string } | null;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseTime(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export async function getAvailableSlots(doctorId: string, date: Date): Promise<{ start: Date; end: Date; available: boolean }[]> {
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId: doctorId },
  });
  if (!profile) return [];

  const workingHours = profile.workingHours as WorkingHours;
  const dayName = DAY_NAMES[date.getDay()];
  const hours = workingHours[dayName];
  if (!hours) return []; // doctor is off this day

  // Check for leave
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  const leave = await prisma.doctorLeave.findFirst({
    where: { doctorId: profile.id, date: dateOnly },
  });
  if (leave) return []; // entire day is leave

  // Generate all slots
  const slotDuration = profile.slotDurationMinutes;
  const slots: { start: Date; end: Date }[] = [];
  let current = parseTime(date, hours.start);
  const end = parseTime(date, hours.end);
  while (current < end) {
    const slotEnd = new Date(current.getTime() + slotDuration * 60_000);
    if (slotEnd > end) break;
    slots.push({ start: new Date(current), end: slotEnd });
    current = slotEnd;
  }

  // Find booked/held slots for this doctor on this date
  const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
  const existing = await prisma.appointment.findMany({
    where: {
      doctorId,
      slotStart: { gte: startOfDay, lte: endOfDay },
      status: { in: ['HELD', 'CONFIRMED'] },
    },
  });

  const now = new Date();
  const blockedStarts = new Set(
    existing
      .filter(a => a.status === 'CONFIRMED' || (a.status === 'HELD' && a.holdExpiresAt && a.holdExpiresAt > now))
      .map(a => a.slotStart.toISOString())
  );

  return slots.map(s => {
    // SERVER-SIDE PAST SLOT FILTER: Past slots relative to current server time are NOT available
    const isPast = s.start <= now;
    const isBlocked = blockedStarts.has(s.start.toISOString());
    return {
      ...s,
      available: !isPast && !isBlocked,
    };
  });
}
