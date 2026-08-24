import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { z } from 'zod';
import { generatePostVisitSummary } from '../services/llm';

const prescriptionItemSchema = z.object({
  drug: z.string(),
  dosage: z.string(),
  frequency: z.string(),
  durationDays: z.number(),
});

const postVisitSchema = z.object({
  doctorNotesRaw: z.string().min(5),
  prescriptionJSON: z.array(prescriptionItemSchema),
});

export async function submitPostVisitNote(req: Request, res: Response) {
  const { appointmentId } = req.params;
  const parsed = postVisitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  if (appointment.doctorId !== req.user!.id) return res.status(403).json({ error: 'Not your appointment' });

  const note = await prisma.postVisitNote.upsert({
    where: { appointmentId },
    create: { appointmentId, doctorNotesRaw: parsed.data.doctorNotesRaw, prescriptionJSON: parsed.data.prescriptionJSON },
    update: { doctorNotesRaw: parsed.data.doctorNotesRaw, prescriptionJSON: parsed.data.prescriptionJSON },
  });

  // Mark appointment as completed
  await prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'COMPLETED' } });

  // Create placeholder PostVisitSummary
  await prisma.postVisitSummary.upsert({
    where: { appointmentId },
    create: { appointmentId, llmStatus: 'PENDING' },
    update: { llmStatus: 'PENDING' },
  });

  // Trigger LLM async
  generatePostVisitSummary(parsed.data.doctorNotesRaw, parsed.data.prescriptionJSON).then(async (result) => {
    if (result.data) {
      await prisma.postVisitSummary.update({
        where: { appointmentId },
        data: {
          patientFriendlySummary: result.data.summary,
          medicationScheduleJSON: result.data.medicationSchedule,
          followUpSteps: result.data.followUpSteps,
          rawLLMResponse: result.rawResponse,
          llmStatus: 'SUCCESS',
          generatedAt: new Date(),
        },
      });
    } else {
      await prisma.postVisitSummary.update({
        where: { appointmentId },
        data: { llmStatus: 'FAILED', rawLLMResponse: result.error },
      });
    }
  }).catch(async (err) => {
    await prisma.postVisitSummary.update({
      where: { appointmentId },
      data: { llmStatus: 'FAILED', rawLLMResponse: String(err) },
    }).catch(() => {});
  });

  return res.status(201).json({ note, message: 'Notes saved. Patient summary being generated.' });
}

export async function getPostVisitSummary(req: Request, res: Response) {
  const { appointmentId } = req.params;
  const [note, summary] = await Promise.all([
    prisma.postVisitNote.findUnique({ where: { appointmentId } }),
    prisma.postVisitSummary.findUnique({ where: { appointmentId } }),
  ]);
  return res.json({ note, summary });
}
