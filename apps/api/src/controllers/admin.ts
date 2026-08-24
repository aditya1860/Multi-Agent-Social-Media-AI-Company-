import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { z } from 'zod';
import { addDoctorLeave } from '../services/doctorLeave';

const leaveSchema = z.object({
  doctorUserId: z.string(),
  date: z.string(),
  reason: z.string().optional(),
});

export async function createDoctorLeave(req: Request, res: Response) {
  const parsed = leaveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const leave = await addDoctorLeave(parsed.data.doctorUserId, parsed.data.date, parsed.data.reason);
    return res.status(201).json(leave);
  } catch (err: any) {
    if (err.message === 'DOCTOR_PROFILE_NOT_FOUND') return res.status(404).json({ error: 'Doctor profile not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Leave already exists for this date' });
    return res.status(500).json({ error: 'Failed to create leave' });
  }
}

export async function deleteDoctorLeave(req: Request, res: Response) {
  const { leaveId } = req.params;
  await prisma.doctorLeave.delete({ where: { id: leaveId } });
  return res.json({ message: 'Leave deleted' });
}

export async function getNotificationLogs(req: Request, res: Response) {
  const { status, appointmentId } = req.query;
  const logs = await prisma.notificationLog.findMany({
    where: {
      ...(status && { status: String(status) as any }),
      ...(appointmentId && { appointmentId: String(appointmentId) }),
    },
    include: { appointment: { select: { id: true, slotStart: true, patientId: true, doctorId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return res.json(logs);
}

export async function getAllDoctors(req: Request, res: Response) {
  const doctors = await prisma.user.findMany({
    where: { role: 'DOCTOR' },
    include: { doctorProfile: true },
  });
  return res.json(doctors);
}

export async function getAllAppointments(req: Request, res: Response) {
  const { status, doctorId, patientId } = req.query;
  const appointments = await prisma.appointment.findMany({
    where: {
      ...(status && { status: String(status) as any }),
      ...(doctorId && { doctorId: String(doctorId) }),
      ...(patientId && { patientId: String(patientId) }),
    },
    include: {
      patient: { select: { id: true, name: true, email: true } },
      doctor: { select: { id: true, name: true, email: true, doctorProfile: true } },
    },
    orderBy: { slotStart: 'desc' },
    take: 200,
  });
  return res.json(appointments);
}
