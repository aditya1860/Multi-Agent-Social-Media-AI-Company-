import { prisma } from '../config/db';
import { sendEmail, buildConfirmationEmail, buildReminderEmail, buildCancellationEmail, buildRescheduleEmail } from '../services/email';
import { env } from '../config/env';

const MAX_RETRIES = parseInt(env.MAX_NOTIFICATION_RETRIES || '3');

export async function retryFailedNotifications(): Promise<void> {
  const failed = await prisma.notificationLog.findMany({
    where: {
      status: 'FAILED',
      attempts: { lt: MAX_RETRIES },
    },
    include: {
      appointment: {
        include: {
          patient: true,
          doctor: true,
        },
      },
    },
    take: 20,
  });

  for (const log of failed) {
    const backoffMs = Math.pow(2, log.attempts) * 60_000; // exponential backoff in minutes
    if (log.lastAttemptAt && Date.now() - log.lastAttemptAt.getTime() < backoffMs) continue;

    try {
      // Re-attempt based on type — simplified: just mark as ABANDONED if max reached
      if (log.attempts >= MAX_RETRIES - 1) {
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: { status: 'ABANDONED', lastAttemptAt: new Date() },
        });
        console.warn(`[NotifRetry] Abandoned notification ${log.id} after ${log.attempts} attempts`);
      } else {
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
        });
        // Could re-attempt send here; for now increment and retry next cycle
      }
    } catch (err) {
      console.error(`[NotifRetry] Error processing log ${log.id}:`, err);
    }
  }
}
