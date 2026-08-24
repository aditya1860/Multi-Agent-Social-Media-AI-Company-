import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './calendar';
import { prisma } from '../config/db';

export async function syncAppointmentToCalendar(appointmentId: string): Promise<void> {
  const apt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, doctor: true },
  });
  if (!apt) return;

  const summary = `Medical Appointment: Dr. ${apt.doctor.name} & ${apt.patient.name}`;
  const description = `Appointment ID: ${apt.id}`;

  const patientEventId = await createCalendarEvent(apt.patientId, {
    summary,
    description,
    start: apt.slotStart,
    end: apt.slotEnd,
    attendeeEmail: apt.doctor.email,
  });

  const doctorEventId = await createCalendarEvent(apt.doctorId, {
    summary,
    description,
    start: apt.slotStart,
    end: apt.slotEnd,
    attendeeEmail: apt.patient.email,
  });

  const links = [];
  if (patientEventId) links.push({ appointmentId: apt.id, userId: apt.patientId, googleEventId: patientEventId });
  if (doctorEventId) links.push({ appointmentId: apt.id, userId: apt.doctorId, googleEventId: doctorEventId });

  if (links.length > 0) {
    await prisma.calendarEventLink.createMany({ data: links }).catch(() => {});
  }
}

export async function updateCalendarSync(appointmentId: string): Promise<void> {
  const apt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!apt) return;

  const links = await prisma.calendarEventLink.findMany({ where: { appointmentId } });
  for (const link of links) {
    await updateCalendarEvent(link.userId, link.googleEventId, {
      start: apt.slotStart,
      end: apt.slotEnd,
    });
  }
}

export async function removeCalendarSync(appointmentId: string): Promise<void> {
  const links = await prisma.calendarEventLink.findMany({ where: { appointmentId } });
  for (const link of links) {
    await deleteCalendarEvent(link.userId, link.googleEventId);
  }
  await prisma.calendarEventLink.deleteMany({ where: { appointmentId } });
}
