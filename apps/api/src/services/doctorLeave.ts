import { prisma } from '../config/db';
import { reconcileLeaveConflicts } from '../jobs/leaveReconciliation';

export async function addDoctorLeave(doctorUserId: string, dateStr: string, reason?: string) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId: doctorUserId } });
  if (!profile) {
    throw new Error('DOCTOR_PROFILE_NOT_FOUND');
  }

  const leaveDate = new Date(dateStr);
  leaveDate.setHours(0, 0, 0, 0);

  // Canonical leave creation
  const leave = await prisma.doctorLeave.create({
    data: {
      doctorId: profile.id,
      date: leaveDate,
      reason,
    },
  });

  // Reconcile conflicts and create NotificationLog rows for affected patients
  await reconcileLeaveConflicts(doctorUserId, leaveDate);

  return leave;
}
