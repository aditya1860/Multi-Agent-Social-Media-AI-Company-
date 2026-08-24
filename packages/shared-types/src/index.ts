import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────
export type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';
export type AppointmentStatus = 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'RESCHEDULED';
export type NotificationChannel = 'EMAIL' | 'CALENDAR';
export type NotificationType = 'CONFIRMATION' | 'REMINDER' | 'CANCELLATION' | 'RESCHEDULE' | 'MEDICATION_REMINDER';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'ABANDONED';
export type LLMStatus = 'SUCCESS' | 'FAILED' | 'FALLBACK' | 'PENDING';

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone?: string | null;
  createdAt: string;
}

// ─── Doctor Profile ────────────────────────────────────────────────────────────
export interface WorkingHoursDay {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export type WorkingHours = {
  [day in 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday']?: WorkingHoursDay | null;
};

export interface DoctorProfile {
  id: string;
  userId: string;
  specialization: string;
  bio?: string | null;
  consultationDuration: number;
  slotDurationMinutes: number;
  workingHours: WorkingHours;
  user?: Pick<User, 'id' | 'name' | 'email'>;
}

// ─── Appointment ───────────────────────────────────────────────────────────────
export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  slotStart: string;
  slotEnd: string;
  status: AppointmentStatus;
  holdExpiresAt?: string | null;
  reason?: string | null;
  createdAt: string;
  patient?: Pick<User, 'id' | 'name' | 'email'>;
  doctor?: Pick<User, 'id' | 'name' | 'email'> & { doctorProfile?: DoctorProfile | null };
  symptomForm?: SymptomForm | null;
  preVisitSummary?: PreVisitSummary | null;
  postVisitNote?: PostVisitNote | null;
  postVisitSummary?: PostVisitSummary | null;
}

// ─── Symptom Form ──────────────────────────────────────────────────────────────
export interface SymptomForm {
  id: string;
  appointmentId: string;
  rawSymptoms: string;
  submittedAt: string;
}

// ─── Pre-Visit Summary ─────────────────────────────────────────────────────────
export interface PreVisitSummary {
  id: string;
  appointmentId: string;
  urgencyLevel?: string | null;
  chiefComplaint?: string | null;
  suggestedQuestions?: string[] | null;
  rawLLMResponse?: string | null;
  llmStatus: LLMStatus;
  generatedAt?: string | null;
}

// ─── Post-Visit Note ───────────────────────────────────────────────────────────
export interface PrescriptionItem {
  drug: string;
  dosage: string;
  frequency: string;
  durationDays: number;
}

export interface PostVisitNote {
  id: string;
  appointmentId: string;
  doctorNotesRaw: string;
  prescriptionJSON: PrescriptionItem[];
  createdAt: string;
}

// ─── Post-Visit Summary ────────────────────────────────────────────────────────
export interface MedicationScheduleItem {
  drug: string;
  dosage: string;
  timesPerDay: number;
  durationDays: number;
}

export interface PostVisitSummary {
  id: string;
  appointmentId: string;
  patientFriendlySummary?: string | null;
  medicationScheduleJSON?: MedicationScheduleItem[] | null;
  followUpSteps?: string[] | null;
  rawLLMResponse?: string | null;
  llmStatus: LLMStatus;
  generatedAt?: string | null;
}

// ─── Notification Log ──────────────────────────────────────────────────────────
export interface NotificationLog {
  id: string;
  appointmentId: string;
  channel: NotificationChannel;
  type: NotificationType;
  status: NotificationStatus;
  attempts: number;
  lastAttemptAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

// ─── Slot ──────────────────────────────────────────────────────────────────────
export interface Slot {
  start: string;
  end: string;
  available: boolean;
}

// ─── API Response Shapes ───────────────────────────────────────────────────────
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiError {
  error: string;
  message?: string;
}

// ─── Zod Schemas (shared validation) ──────────────────────────────────────────
export const holdSlotSchema = z.object({
  doctorId: z.string(),
  slotStart: z.string().datetime(),
  slotEnd: z.string().datetime(),
  reason: z.string().optional(),
});

export const symptomFormSchema = z.object({
  rawSymptoms: z.string().min(10, 'Please describe your symptoms in detail (at least 10 characters)'),
});

export const prescriptionItemSchema = z.object({
  drug: z.string().min(1, 'Drug name required'),
  dosage: z.string().min(1, 'Dosage required'),
  frequency: z.string().min(1, 'Frequency required'),
  durationDays: z.number().int().min(1, 'Duration must be at least 1 day'),
});

export const postVisitNoteSchema = z.object({
  doctorNotesRaw: z.string().min(10, 'Clinical notes required'),
  prescriptionJSON: z.array(prescriptionItemSchema),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password required'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['PATIENT', 'DOCTOR']).default('PATIENT'),
  phone: z.string().optional(),
});
