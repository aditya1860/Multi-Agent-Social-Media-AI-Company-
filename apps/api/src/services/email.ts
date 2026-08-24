import nodemailer from 'nodemailer';
import { env } from '../config/env';

function getTransport() {
  if (env.SMTP_HOST && env.SMTP_PASS) {
    console.log(`[Email Service] Initializing Nodemailer SMTP transport for host: ${env.SMTP_HOST}`);
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: parseInt(env.SMTP_PORT || '587'),
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  console.log('[Email Service] No custom SMTP credentials found. Using Ethereal development transport.');
  return nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, auth: { user: 'test', pass: 'test' } });
}

const baseTemplate = (content: string) => `
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: 'Inter', Arial, sans-serif; background: linear-gradient(135deg, #6FE0D0, #FFD9C2); margin: 0; padding: 20px; }
  .card { background: rgba(255,255,255,0.92); border-radius: 20px; padding: 32px 40px; max-width: 560px; margin: 0 auto; box-shadow: 0 8px 24px rgba(15,60,55,0.12); }
  h1 { color: #1F9E93; font-size: 22px; margin-bottom: 8px; }
  .badge { display: inline-block; background: #1F9E93; color: white; border-radius: 999px; padding: 4px 14px; font-size: 13px; margin-bottom: 16px; }
  .badge-danger { background: #FF6F59; }
  p { color: #374151; line-height: 1.6; }
  .slot-box { background: #F0FDFB; border: 1px solid #6FE0D0; border-radius: 12px; padding: 16px; margin: 16px 0; }
  .slot-box b { color: #1F9E93; }
  .btn { display: inline-block; background: #1F9E93; color: white; text-decoration: none; border-radius: 10px; padding: 12px 24px; font-weight: 600; margin-top: 16px; }
  .footer { color: #9CA3AF; font-size: 12px; margin-top: 24px; text-align: center; }
</style></head><body><div class="card">${content}</div></body></html>`;

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(opts: EmailOptions): Promise<{ success: boolean; error?: string }> {
  console.log(`[Email Service] Attempting to send email to: ${opts.to} | Subject: "${opts.subject}"`);
  try {
    const transport = getTransport();
    const info = await transport.sendMail({ from: env.EMAIL_FROM, ...opts });
    console.log(`[Email Service] Email sent successfully to ${opts.to}! Message ID: ${info.messageId || 'sent'}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[Email Service] FAILED to send email to ${opts.to}:`, err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

export function buildConfirmationEmail(data: {
  patientName: string;
  doctorName: string;
  specialization: string;
  slotStart: Date;
  slotEnd: Date;
  appointmentId: string;
}) {
  const dateStr = data.slotStart.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = `${data.slotStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${data.slotEnd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  return baseTemplate(`
    <span class="badge">Appointment Confirmed</span>
    <h1>Your appointment is booked!</h1>
    <p>Hi ${data.patientName}, your appointment has been confirmed.</p>
    <div class="slot-box">
      <b>Doctor:</b> Dr. ${data.doctorName} · ${data.specialization}<br/>
      <b>Date:</b> ${dateStr}<br/>
      <b>Time:</b> ${timeStr}
    </div>
    <p>Please complete your symptom form before the appointment to help the doctor prepare.</p>
    <div class="footer">Vitalis Appointment Manager · Appointment ID: ${data.appointmentId}</div>
  `);
}

export function buildReminderEmail(data: {
  patientName: string;
  doctorName: string;
  slotStart: Date;
  hoursAhead: number;
}) {
  const timeStr = data.slotStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return baseTemplate(`
    <span class="badge">Reminder</span>
    <h1>Appointment in ${data.hoursAhead} hour${data.hoursAhead !== 1 ? 's' : ''}</h1>
    <p>Hi ${data.patientName}, don't forget your appointment with Dr. ${data.doctorName} at ${timeStr} today.</p>
    <div class="footer">Vitalis Appointment Manager</div>
  `);
}

export function buildCancellationEmail(data: {
  patientName: string;
  doctorName: string;
  slotStart: Date;
  reason?: string;
}) {
  return baseTemplate(`
    <span class="badge badge-danger">Appointment Cancelled</span>
    <h1>Your appointment has been cancelled</h1>
    <p>Hi ${data.patientName}, your appointment with Dr. ${data.doctorName} on ${data.slotStart.toLocaleDateString()} has been cancelled${data.reason ? ` due to: ${data.reason}` : ''}.</p>
    <p>Please book a new appointment at your convenience.</p>
    <div class="footer">Vitalis Appointment Manager</div>
  `);
}

export function buildRescheduleEmail(data: {
  patientName: string;
  doctorName: string;
  oldSlotStart: Date;
  reason?: string;
}) {
  return baseTemplate(`
    <span class="badge">Reschedule Required</span>
    <h1>Your appointment needs to be rescheduled</h1>
    <p>Hi ${data.patientName}, your appointment with Dr. ${data.doctorName} on ${data.oldSlotStart.toLocaleDateString()} cannot proceed as planned${data.reason ? ` (${data.reason})` : ''}.</p>
    <p>Please log in to book a new slot at your convenience.</p>
    <div class="footer">Vitalis Appointment Manager</div>
  `);
}
