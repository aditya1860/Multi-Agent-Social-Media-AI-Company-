import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getAvailableSlots } from '../services/slots';

const doctorProfileSchema = z.object({
  specialization: z.string(),
  bio: z.string().optional(),
  consultationDuration: z.number().default(30),
  slotDurationMinutes: z.number().default(30),
  workingHours: z.record(z.union([z.object({ start: z.string(), end: z.string() }), z.null()])),
});

export async function getDoctors(req: Request, res: Response) {
  const { specialization, date } = req.query;
  const profiles = await prisma.doctorProfile.findMany({
    where: specialization ? { specialization: { contains: String(specialization), mode: 'insensitive' } } : {},
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return res.json(profiles);
}

export async function getDoctorById(req: Request, res: Response) {
  const { id } = req.params;
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!profile) return res.status(404).json({ error: 'Doctor not found' });
  return res.json(profile);
}

export async function getDoctorSlots(req: Request, res: Response) {
  const { id } = req.params;
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
  const dateObj = new Date(String(date));
  if (isNaN(dateObj.getTime())) return res.status(400).json({ error: 'Invalid date' });
  const slots = await getAvailableSlots(id, dateObj);
  return res.json(slots);
}

const createDoctorFullSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  specialization: z.string().min(2),
  bio: z.string().optional(),
  consultationDuration: z.number().default(30),
  slotDurationMinutes: z.number().default(30),
  workingHours: z.record(z.union([z.object({ start: z.string(), end: z.string() }), z.null()])),
});

export async function createDoctorProfile(req: Request, res: Response) {
  // Check if creating a full Doctor User + Profile
  if (req.body.name && req.body.email && req.body.password) {
    const parsed = createDoctorFullSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    
    const { name, email, password, phone, specialization, bio, consultationDuration, slotDurationMinutes, workingHours } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'DOCTOR',
        phone,
        doctorProfile: {
          create: {
            specialization,
            bio,
            consultationDuration,
            slotDurationMinutes,
            workingHours,
          },
        },
      },
      include: { doctorProfile: true },
    });

    return res.status(201).json(user);
  }

  // Fallback to legacy single profile creation if userId provided
  const parsed = doctorProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const userId = req.body.userId || req.user!.id;
  const existing = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (existing) return res.status(409).json({ error: 'Profile already exists' });
  const profile = await prisma.doctorProfile.create({ data: { userId, ...parsed.data } });
  return res.status(201).json(profile);
}

export async function updateDoctorProfile(req: Request, res: Response) {
  const parsed = doctorProfileSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const userId = req.params.id || req.user!.id;
  const profile = await prisma.doctorProfile.update({ where: { userId }, data: parsed.data });
  return res.json(profile);
}

export async function getDoctorLeaves(req: Request, res: Response) {
  const userId = req.params.id || req.user!.id;
  const profile = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!profile) return res.status(404).json({ error: 'Doctor profile not found' });
  const leaves = await prisma.doctorLeave.findMany({ where: { doctorId: profile.id } });
  return res.json(leaves);
}
