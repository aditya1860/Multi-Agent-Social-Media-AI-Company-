import { prisma } from '../config/db';

export async function releaseExpiredHolds(): Promise<void> {
  const result = await prisma.appointment.updateMany({
    where: {
      status: 'HELD',
      holdExpiresAt: { lt: new Date() },
    },
    data: { status: 'CANCELLED', holdExpiresAt: null },
  });
  if (result.count > 0) {
    console.log(`[HoldExpiry] Released ${result.count} expired holds`);
  }
}
