import { prisma } from '../config/db';
import { sendNotification } from './notifications';
import { NotificationChannel, NotificationType } from '@prisma/client';

export async function processMedicationReminders(): Promise<void> {
  const activeSummaries = await prisma.postVisitSummary.findMany({
    where: {
      llmStatus: 'SUCCESS',
      generatedAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) }, // past 30 days
    },
    include: {
      appointment: {
        include: {
          patient: true,
          doctor: true,
        },
      },
    },
  });

  for (const summary of activeSummaries) {
    const schedule = summary.medicationScheduleJSON as Array<{
      drug: string;
      dosage: string;
      timesPerDay: number;
      durationDays: number;
    }> | null;

    if (!schedule || !Array.isArray(schedule)) continue;

    for (const med of schedule) {
      await sendNotification({
        appointmentId: summary.appointmentId,
        channel: NotificationChannel.EMAIL,
        type: NotificationType.MEDICATION_REMINDER,
        payload: {
          patientEmail: summary.appointment.patient.email,
          patientName: summary.appointment.patient.name,
          doctorName: summary.appointment.doctor.name,
          drug: med.drug,
          dosage: med.dosage,
          timesPerDay: med.timesPerDay,
        },
      });
    }
  }
}
