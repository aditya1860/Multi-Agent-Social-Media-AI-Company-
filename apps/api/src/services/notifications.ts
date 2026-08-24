import { prisma } from '../config/db';
import { NotificationChannel, NotificationType, NotificationStatus } from '@prisma/client';
import { sendEmail, buildConfirmationEmail, buildReminderEmail, buildCancellationEmail, buildRescheduleEmail } from './email';

export async function sendNotification(args: {
  appointmentId: string;
  channel: NotificationChannel;
  type: NotificationType;
  payload: Record<string, any>;
}): Promise<void> {
  console.log(`[Notification Service] Creating PENDING log for ${args.type} notification via ${args.channel} to appointment ${args.appointmentId}...`);

  // 1. Create PENDING log first — booking success is independent of notification
  const log = await prisma.notificationLog.create({
    data: {
      appointmentId: args.appointmentId,
      channel: args.channel,
      type: args.type,
      status: NotificationStatus.PENDING,
    },
  });

  // 2. Attempt send (never throws to caller)
  try {
    let result: { success: boolean; error?: string };
    if (args.channel === NotificationChannel.EMAIL) {
      result = await attemptEmailSend(args.type, args.payload);
    } else {
      result = { success: false, error: 'Calendar handled separately' };
    }

    const finalStatus = result.success ? NotificationStatus.SENT : NotificationStatus.FAILED;
    console.log(`[Notification Service] Notification ${log.id} status updated to: ${finalStatus}${result.error ? ` (Error: ${result.error})` : ''}`);

    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: finalStatus,
        attempts: 1,
        lastAttemptAt: new Date(),
        errorMessage: result.error || null,
      },
    });
  } catch (err: any) {
    console.error(`[Notification Service] Exception sending notification ${log.id}:`, err);
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: NotificationStatus.FAILED,
        attempts: 1,
        lastAttemptAt: new Date(),
        errorMessage: err?.message || String(err),
      },
    }).catch(() => {}); // ignore update failure
  }
}

async function attemptEmailSend(type: NotificationType, payload: any): Promise<{ success: boolean; error?: string }> {
  const { sendEmail: send, buildConfirmationEmail, buildReminderEmail, buildCancellationEmail, buildRescheduleEmail } = await import('./email');
  let html = '';
  let subject = '';
  switch (type) {
    case 'CONFIRMATION':
      html = buildConfirmationEmail(payload);
      subject = 'Appointment Confirmed';
      break;
    case 'REMINDER':
      html = buildReminderEmail(payload);
      subject = `Appointment Reminder — ${payload.hoursAhead}h ahead`;
      break;
    case 'CANCELLATION':
      html = buildCancellationEmail(payload);
      subject = 'Appointment Cancelled';
      break;
    case 'RESCHEDULE':
      html = buildRescheduleEmail(payload);
      subject = 'Appointment Reschedule Required';
      break;
    default:
      return { success: false, error: `Unhandled notification type: ${type}` };
  }
  return send({ to: payload.patientEmail, subject, html });
}
