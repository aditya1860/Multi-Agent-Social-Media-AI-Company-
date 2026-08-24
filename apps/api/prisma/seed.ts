import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Vitalis database...');

  // Admin
  const adminPass = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@vitalis.app' },
    update: { passwordHash: adminPass },
    create: { name: 'Admin', email: 'admin@vitalis.app', passwordHash: adminPass, role: 'ADMIN' },
  });
  console.log(`✅ Admin created: ${admin.email}`);

  // Doctor 1
  const doc1Pass = await bcrypt.hash('Doctor@123', 12);
  const doctor1 = await prisma.user.upsert({
    where: { email: 'dr.smith@vitalis.app' },
    update: { passwordHash: doc1Pass },
    create: { name: 'Dr. Emily Smith', email: 'dr.smith@vitalis.app', passwordHash: doc1Pass, role: 'DOCTOR' },
  });
  await prisma.doctorProfile.upsert({
    where: { userId: doctor1.id },
    update: {},
    create: {
      userId: doctor1.id,
      specialization: 'Cardiology',
      bio: 'Board-certified cardiologist with 15 years experience.',
      slotDurationMinutes: 30,
      workingHours: {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '13:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '16:00' },
        saturday: null,
        sunday: null,
      },
    },
  });
  console.log(`✅ Doctor 1 created: ${doctor1.email}`);

  // Doctor 2
  const doc2Pass = await bcrypt.hash('Doctor@123', 12);
  const doctor2 = await prisma.user.upsert({
    where: { email: 'dr.chen@vitalis.app' },
    update: { passwordHash: doc2Pass },
    create: { name: 'Dr. James Chen', email: 'dr.chen@vitalis.app', passwordHash: doc2Pass, role: 'DOCTOR' },
  });
  await prisma.doctorProfile.upsert({
    where: { userId: doctor2.id },
    update: {},
    create: {
      userId: doctor2.id,
      specialization: 'Neurology',
      bio: 'Specialist in cognitive and movement disorders.',
      slotDurationMinutes: 45,
      workingHours: {
        monday: { start: '10:00', end: '18:00' },
        tuesday: { start: '10:00', end: '18:00' },
        wednesday: null,
        thursday: { start: '10:00', end: '18:00' },
        friday: { start: '10:00', end: '15:00' },
        saturday: { start: '10:00', end: '13:00' },
        sunday: null,
      },
    },
  });
  console.log(`✅ Doctor 2 created: ${doctor2.email}`);

  // Patient
  const patPass = await bcrypt.hash('Patient@123', 12);
  const patient = await prisma.user.upsert({
    where: { email: 'patient@vitalis.app' },
    update: { passwordHash: patPass },
    create: { name: 'Alex Johnson', email: 'patient@vitalis.app', passwordHash: patPass, role: 'PATIENT', phone: '+1-555-0100' },
  });
  console.log(`✅ Patient created: ${patient.email}`);

  console.log('\n🎉 Seed complete! Demo credentials:');
  console.log('  Patient  → patient@vitalis.app  / Patient@123');
  console.log('  Doctor   → dr.smith@vitalis.app / Doctor@123');
  console.log('  Admin    → admin@vitalis.app    / Admin@123');
}

main()
  .catch(err => { console.error('❌ Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
