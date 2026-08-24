import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { z } from 'zod';
import { env } from '../config/env';
import { sendNotification } from '../services/notifications';
import { createCalendarEvent } from '../services/calendar';
import { removeCalendarSync, updateCalendarSync } from '../services/calendarSync';

const holdSchema = z.object({
  doctorId: z.string(),
  slotStart: z.string().datetime(),
  slotEnd: z.string().datetime(),
  reason: z.string().optional(),
});

const confirmSchema = z.object({
  appointmentId: z.string(),
});

const rescheduleSchema = z.object({
  slotStart: z.string().datetime(),
  slotEnd: z.string().datetime(),
});

export async function holdSlot(req: Request, res: Response) {
  const parsed = holdSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { doctorId, slotStart, slotEnd, reason } = parsed.data;
  const patientId = req.user!.id;
  const holdTTL = parseInt(env.SLOT_HOLD_TTL_MINUTES) * 60_000;
  const holdExpiresAt = new Date(Date.now() + holdTTL);
  const slotStartDate = new Date(slotStart);
  const slotEndDate = new Date(slotEnd);

  try {
    /**
     * CONCURRENCY SAFETY:
     * We use a serializable transaction + unique constraint.
     * Prisma serializable isolates this transaction so concurrent reads
     * of the same slot both see the same committed state.
     * The @@unique([doctorId, slotStart]) constraint acts as the final
     * guarantee: even if two transactions somehow pass the existence check,
     * only one INSERT can succeed — the second gets a P2002 unique violation.
     */
    const appointment = await prisma.$transaction(async (tx) => {
      // Check for existing active booking
      const now = new Date();
      const existing = await tx.appointment.findFirst({
        where: {
          doctorId,
          slotStart: slotStartDate,
          status: { in: ['HELD', 'CONFIRMED'] },
          OR: [
            { status: 'CONFIRMED' },
            { status: 'HELD', holdExpiresAt: { gt: now } },
          ],
        },
      });
      if (existing) {
        throw new Error('SLOT_TAKEN');
      }
      return tx.appointment.create({
        data: {
          patientId,
          doctorId,
          slotStart: slotStartDate,
          slotEnd: slotEndDate,
          status: 'HELD',
          holdExpiresAt,
          reason,
        },
      });
    }, { isolationLevel: 'Serializable' });

    return res.status(201).json(appointment);
  } catch (err: any) {
    if (err.message === 'SLOT_TAKEN' || err.code === 'P2002') {
      return res.status(409).json({ error: 'This slot was just taken. Please pick another time.' });
    }
    console.error('[HoldSlot] Error:', err);
    return res.status(500).json({ error: 'Failed to hold slot' });
  }
}

export async function confirmAppointment(req: Request, res: Response) {
  const { appointmentId } = req.params;
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, doctor: { include: { doctorProfile: true } } },
  });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  if (appointment.patientId !== req.user!.id) return res.status(403).json({ error: 'Not your appointment' });
  if (appointment.status !== 'HELD') return res.status(400).json({ error: `Cannot confirm: status is ${appointment.status}` });
  if (appointment.holdExpiresAt && appointment.holdExpiresAt < new Date()) {
    return res.status(400).json({ error: 'Hold has expired. Please book again.' });
  }
  const confirmed = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CONFIRMED', holdExpiresAt: null },
    include: { patient: true, doctor: true },
  });

  // Fire-and-forget notification (never blocks response)
  sendNotification({
    appointmentId: confirmed.id,
    channel: 'EMAIL',
    type: 'CONFIRMATION',
    payload: {
      patientEmail: confirmed.patient.email,
      patientName: confirmed.patient.name,
      doctorName: confirmed.doctor.name,
      specialization: appointment.doctor.doctorProfile?.specialization || '',
      slotStart: confirmed.slotStart,
      slotEnd: confirmed.slotEnd,
      appointmentId: confirmed.id,
    },
  }).catch(err => console.error('[Confirm] Notification error:', err));

  // Calendar events for patient and doctor (fire-and-forget)
  const summary = `Medical Appointment with Dr. ${confirmed.doctor.name}`;
  const description = `Appointment ID: ${confirmed.id}`;
  Promise.all([
    createCalendarEvent(confirmed.patientId, { summary, description, start: confirmed.slotStart, end: confirmed.slotEnd, attendeeEmail: confirmed.doctor.email }),
    createCalendarEvent(confirmed.doctorId, { summary: `Patient: ${confirmed.patient.name}`, description, start: confirmed.slotStart, end: confirmed.slotEnd }),
  ]).then(async ([patientEventId, doctorEventId]) => {
    const links = [];
    if (patientEventId) links.push({ appointmentId: confirmed.id, userId: confirmed.patientId, googleEventId: patientEventId });
    if (doctorEventId) links.push({ appointmentId: confirmed.id, userId: confirmed.doctorId, googleEventId: doctorEventId });
    if (links.length) await prisma.calendarEventLink.createMany({ data: links }).catch(() => {});
  }).catch(() => {});

  return res.json(confirmed);
}

export async function cancelAppointment(req: Request, res: Response) {
  const { appointmentId } = req.params;
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, doctor: true },
  });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  // Allow patient to cancel their own, or admin/doctor
  if (req.user!.role === 'PATIENT' && appointment.patientId !== req.user!.id) {
    return res.status(403).json({ error: 'Not your appointment' });
  }
  if (!['HELD', 'CONFIRMED'].includes(appointment.status)) {
    return res.status(400).json({ error: `Cannot cancel: status is ${appointment.status}` });
  }
  const cancelled = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CANCELLED' },
    include: { patient: true, doctor: true },
  });
  
  // Remove Google Calendar events if synced
  removeCalendarSync(cancelled.id).catch(() => {});

  sendNotification({
    appointmentId: cancelled.id,
    channel: 'EMAIL',
    type: 'CANCELLATION',
    payload: {
      patientEmail: cancelled.patient.email,
      patientName: cancelled.patient.name,
      doctorName: cancelled.doctor.name,
      slotStart: cancelled.slotStart,
    },
  }).catch(() => {});
  return res.json(cancelled);
}

export async function rescheduleAppointment(req: Request, res: Response) {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { appointmentId } = req.params;
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { patient: true, doctor: true } });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { slotStart: new Date(parsed.data.slotStart), slotEnd: new Date(parsed.data.slotEnd), status: 'CONFIRMED' },
    include: { patient: true, doctor: true },
  });

  // Update Google Calendar events if synced
  updateCalendarSync(updated.id).catch(() => {});

  sendNotification({
    appointmentId: updated.id,
    channel: 'EMAIL',
    type: 'RESCHEDULE',
    payload: {
      patientEmail: updated.patient.email,
      patientName: updated.patient.name,
      doctorName: updated.doctor.name,
      oldSlotStart: appointment.slotStart,
    },
  }).catch(() => {});
  return res.json(updated);
}

export async function getMyAppointments(req: Request, res: Response) {
  const userId = req.user!.id;
  const role = req.user!.role;
  const where = role === 'PATIENT' ? { patientId: userId } : role === 'DOCTOR' ? { doctorId: userId } : {};
  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { id: true, name: true, email: true } },
      doctor: { select: { id: true, name: true, email: true, doctorProfile: true } },
      symptomForm: true,
      preVisitSummary: true,
      postVisitNote: true,
      postVisitSummary: true,
    },
    orderBy: { slotStart: 'desc' },
  });
  return res.json(appointments);
}

export async function getAppointmentById(req: Request, res: Response) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.appointmentId },
    include: {
      patient: { select: { id: true, name: true, email: true } },
      doctor: { select: { id: true, name: true, email: true, doctorProfile: true } },
      symptomForm: true,
      preVisitSummary: true,
      postVisitNote: true,
      postVisitSummary: true,
      notificationLogs: true,
    },
  });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  return res.json(appointment);
}
