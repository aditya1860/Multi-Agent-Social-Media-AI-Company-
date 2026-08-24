import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { z } from 'zod';
import { generatePreVisitSummary } from '../services/llm';

const symptomSchema = z.object({
  rawSymptoms: z.string().min(10),
});

export async function submitSymptomForm(req: Request, res: Response) {
  const { appointmentId } = req.params;
  const parsed = symptomSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  if (appointment.patientId !== req.user!.id) return res.status(403).json({ error: 'Not your appointment' });

  // Create or update symptom form
  const symptomForm = await prisma.symptomForm.upsert({
    where: { appointmentId },
    create: { appointmentId, rawSymptoms: parsed.data.rawSymptoms },
    update: { rawSymptoms: parsed.data.rawSymptoms },
  });

  // Create placeholder PreVisitSummary with PENDING status
  await prisma.preVisitSummary.upsert({
    where: { appointmentId },
    create: { appointmentId, llmStatus: 'PENDING' },
    update: { llmStatus: 'PENDING' },
  });

  // Trigger LLM async (never blocks response)
  generatePreVisitSummary(parsed.data.rawSymptoms).then(async (result) => {
    if (result.data) {
      await prisma.preVisitSummary.update({
        where: { appointmentId },
        data: {
          urgencyLevel: result.data.urgencyLevel,
          chiefComplaint: result.data.chiefComplaint,
          suggestedQuestions: result.data.suggestedQuestions,
          rawLLMResponse: result.rawResponse,
          llmStatus: 'SUCCESS',
          generatedAt: new Date(),
        },
      });
    } else {
      await prisma.preVisitSummary.update({
        where: { appointmentId },
        data: { llmStatus: 'FAILED', urgencyLevel: 'Unspecified', rawLLMResponse: result.error },
      });
    }
  }).catch(async (err) => {
    await prisma.preVisitSummary.update({
      where: { appointmentId },
      data: { llmStatus: 'FAILED', urgencyLevel: 'Unspecified', rawLLMResponse: String(err) },
    }).catch(() => {});
  });

  return res.status(201).json({ symptomForm, message: 'Symptom form submitted. AI summary being generated.' });
}

export async function getPreVisitSummary(req: Request, res: Response) {
  const { appointmentId } = req.params;
  const summary = await prisma.preVisitSummary.findUnique({ where: { appointmentId } });
  const symptomForm = await prisma.symptomForm.findUnique({ where: { appointmentId } });
  if (!summary) return res.status(404).json({ error: 'Pre-visit summary not found' });
  return res.json({ summary, symptomForm });
}
