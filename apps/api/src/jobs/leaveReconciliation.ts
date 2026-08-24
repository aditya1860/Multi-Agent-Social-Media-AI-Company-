import { prisma } from '../config/db';
import { sendNotification } from '../services/notifications';

export async function reconcileLeaveConflicts(doctorId: string, leaveDate: Date): Promise<void> {
  const startOfDay = new Date(leaveDate); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(leaveDate); endOfDay.setHours(23, 59, 59, 999);

  // Find CONFIRMED appointments that clash with the new leave
  const affected = await prisma.appointment.findMany({
    where: {
      doctorId,
      slotStart: { gte: startOfDay, lte: endOfDay },
      status: 'CONFIRMED',
    },
    include: {
      patient: true,
      doctor: true,
    },
  });

  for (const apt of affected) {
    // Mark as RESCHEDULED
    await prisma.appointment.update({
      where: { id: apt.id },
      data: { status: 'RESCHEDULED' },
    });

    // Send reschedule notification (fire and forget — writes NotificationLog)
    sendNotification({
      appointmentId: apt.id,
      channel: 'EMAIL',
      type: 'RESCHEDULE',
      payload: {
        patientEmail: apt.patient.email,
        patientName: apt.patient.name,
        doctorName: apt.doctor.name,
        oldSlotStart: apt.slotStart,
        reason: 'Doctor unavailable on this date',
      },
    }).catch(err => console.error('[LeaveReconcile] Notification error:', err));
  }

  console.log(`[LeaveReconcile] Marked ${affected.length} appointments for reschedule on ${leaveDate.toDateString()}`);
}
