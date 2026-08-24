<<<<<<< HEAD
# Vitalis — Clinical Appointment & Follow-up Manager

A production-grade clinical appointment system supporting three roles (Patient, Doctor, Admin) with AI-powered pre-visit and post-visit summaries, Google Calendar integration, and bulletproof double-booking prevention.

---

## Architecture

```
healthcare/
├── apps/
│   ├── api/           ← Node.js + Express + TypeScript + Prisma + PostgreSQL
│   └── web/           ← React + TypeScript + Vite + Tailwind + Clay Clinical theme
├── packages/
│   └── shared-types/  ← Shared TypeScript types + Zod schemas
├── render.yaml        ← Backend deployment (Render)
└── vercel.json        ← Frontend deployment (Vercel)
```

---

## Quick Start (Local Dev)

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ running locally (or Docker: `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15`)

### 1. Clone and install
```bash
cd healthcare

# Install all dependencies
npm install --prefix apps/api
npm install --prefix apps/web
```

### 2. Configure environment

**Backend** (`apps/api/.env`):
```bash
cp apps/api/.env.example apps/api/.env
# Edit DATABASE_URL, JWT secrets (already filled with dev defaults)
```

**Frontend** (`apps/web/.env`):
```
VITE_API_URL=http://localhost:5000/api
```

### 3. Database setup
```bash
# Generate Prisma client
cd apps/api && npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate dev --name init

# Seed demo data (admin, 2 doctors, 1 patient)
npm run db:seed
```

### 4. Start development servers

Terminal 1 (API):
```bash
cd apps/api && npm run dev
```

Terminal 2 (Frontend):
```bash
cd apps/web && npm run dev
```

Frontend: http://localhost:5173  
API: http://localhost:5000

---

## Demo Credentials

| Role    | Email                       | Password     |
|---------|-----------------------------|--------------|
| Patient | patient@healthcare.app      | Patient@123  |
| Doctor  | dr.smith@healthcare.app     | Doctor@123   |
| Doctor  | dr.chen@healthcare.app      | Doctor@123   |
| Admin   | admin@healthcare.app        | Admin@123    |

---

## Environment Variables

### Backend (`apps/api/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✅ | Min 32-char secret for access tokens |
| `JWT_REFRESH_SECRET` | ✅ | Min 32-char secret for refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | ❌ | Default: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | ❌ | Default: `7d` |
| `PORT` | ❌ | Default: `5000` |
| `FRONTEND_URL` | ❌ | CORS origin, default `http://localhost:5173` |
| `ANTHROPIC_API_KEY` | ❌ | Enable AI summaries (Claude claude-3-5-sonnet) |
| `SMTP_HOST` | ❌ | SMTP host (e.g. `smtp.sendgrid.net`) |
| `SMTP_PORT` | ❌ | SMTP port (e.g. `587`) |
| `SMTP_USER` | ❌ | SMTP username |
| `SMTP_PASS` | ❌ | SMTP password / API key |
| `EMAIL_FROM` | ❌ | From address for emails |
| `GOOGLE_CLIENT_ID` | ❌ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ❌ | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | ❌ | OAuth callback URL |
| `SLOT_HOLD_TTL_MINUTES` | ❌ | Hold duration, default `5` |
| `MAX_NOTIFICATION_RETRIES` | ❌ | Max retries before ABANDONED, default `3` |

### Frontend (`apps/web/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Backend API base URL |

---

## API Documentation

All authenticated endpoints require `Authorization: Bearer <accessToken>` header.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register patient or doctor |
| POST | `/api/auth/login` | No | Login, returns tokens |
| POST | `/api/auth/refresh` | No | Refresh access token |
| GET | `/api/auth/me` | Yes | Get current user profile |

**Register payload:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "min8chars",
  "role": "PATIENT",
  "phone": "+1-555-0100"
}
```

**Login response:**
```json
{
  "user": { "id": "...", "name": "...", "email": "...", "role": "PATIENT" },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### Doctors

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/doctors` | No | List doctors; `?specialization=Cardiology` |
| GET | `/api/doctors/:id` | No | Get doctor profile |
| GET | `/api/doctors/:id/slots?date=YYYY-MM-DD` | No | Available slots for date |
| GET | `/api/doctors/:id/leaves` | Yes | Doctor leave days |
| POST | `/api/doctors` | ADMIN | Create doctor profile |
| PUT | `/api/doctors/:id` | ADMIN/DOCTOR | Update doctor profile |

**Doctor profile payload:**
```json
{
  "userId": "...",
  "specialization": "Cardiology",
  "bio": "Board-certified...",
  "slotDurationMinutes": 30,
  "workingHours": {
    "monday": { "start": "09:00", "end": "17:00" },
    "tuesday": { "start": "09:00", "end": "17:00" },
    "wednesday": null,
    "saturday": null,
    "sunday": null
  }
}
```

### Appointments

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/appointments/my` | Yes | My appointments (role-aware) |
| GET | `/api/appointments/:id` | Yes | Appointment detail with summaries |
| POST | `/api/appointments/hold` | PATIENT | Hold slot (creates HELD appointment) |
| POST | `/api/appointments/:id/confirm` | PATIENT | Confirm held appointment |
| POST | `/api/appointments/:id/cancel` | Yes | Cancel appointment |
| POST | `/api/appointments/:id/reschedule` | Yes | Reschedule appointment |

**Hold slot payload:**
```json
{
  "doctorId": "user-id-of-doctor",
  "slotStart": "2026-08-25T09:00:00.000Z",
  "slotEnd": "2026-08-25T09:30:00.000Z"
}
```

**409 response (slot taken):**
```json
{ "error": "This slot was just taken. Please pick another time." }
```

### Symptoms & Pre-visit Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/appointments/:id/symptoms` | PATIENT | Submit symptom form (triggers LLM) |
| GET | `/api/appointments/:id/pre-visit` | Yes | Get pre-visit summary + symptoms |

**Symptom payload:**
```json
{ "rawSymptoms": "Chest pain for 3 days, worse on exertion..." }
```

### Post-Visit Notes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/appointments/:id/notes` | DOCTOR | Submit post-visit notes (triggers LLM) |
| GET | `/api/appointments/:id/summary` | Yes | Get post-visit note + patient summary |

**Notes payload:**
```json
{
  "doctorNotesRaw": "Patient presented with chest pain...",
  "prescriptionJSON": [
    { "drug": "Aspirin", "dosage": "100mg", "frequency": "Once daily", "durationDays": 30 }
  ]
}
```

### Admin

All admin endpoints require ADMIN role.

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/doctors` | All doctors with profiles |
| GET | `/api/admin/appointments` | All appointments (filterable by status/doctor/patient) |
| POST | `/api/admin/leave` | Create doctor leave (triggers conflict reconciliation) |
| DELETE | `/api/admin/leave/:leaveId` | Delete leave day |
| GET | `/api/admin/notifications` | Notification logs (filterable by status) |

**Create leave payload:**
```json
{
  "doctorUserId": "doctor-user-id",
  "date": "2026-09-15",
  "reason": "Conference"
}
```

### Calendar OAuth

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/calendar/auth` | Yes | Get Google OAuth authorization URL |
| GET | `/api/calendar/oauth/callback` | No | OAuth callback (handled by Google redirect) |
| GET | `/api/calendar/status` | Yes | Check if user has connected calendar |

---

## Database Schema

```
User
 ├── id, role (PATIENT/DOCTOR/ADMIN), name, email, passwordHash, phone
 ├── DoctorProfile (1:1)
 │    ├── specialization, bio, slotDurationMinutes
 │    ├── workingHours (JSON: day → {start, end} | null)
 │    └── DoctorLeave[] (doctor_id, date UNIQUE, reason)
 ├── patientAppointments[] (as patient)
 ├── doctorAppointments[] (as doctor)
 ├── GoogleOAuthToken (1:1, optional)
 └── CalendarEventLink[]

Appointment
 ├── id, patientId, doctorId, slotStart, slotEnd
 ├── status (HELD/CONFIRMED/CANCELLED/COMPLETED/RESCHEDULED)
 ├── holdExpiresAt (null when confirmed)
 ├── @@unique([doctorId, slotStart])  ← DB-level double-booking prevention
 ├── SymptomForm (1:1)
 ├── PreVisitSummary (1:1) — urgencyLevel, chiefComplaint, suggestedQuestions, llmStatus
 ├── PostVisitNote (1:1) — doctorNotesRaw, prescriptionJSON
 ├── PostVisitSummary (1:1) — patientFriendlySummary, medicationScheduleJSON, followUpSteps
 ├── NotificationLog[] — channel, type, status, attempts, errorMessage
 └── CalendarEventLink[] — userId, googleEventId (one per connected participant)
```

---

## LLM Prompts

### Pre-visit Summary (called after symptom form submission)

```
Analyse these symptoms and return a JSON object with EXACTLY these fields:
- urgencyLevel: "Low", "Medium", or "High"
- chiefComplaint: string describing the main complaint in one sentence
- suggestedQuestions: array of exactly 3 questions the doctor should ask

Symptoms: <patient symptoms here>

Respond with valid JSON only.
```

**Response schema:**
```json
{
  "urgencyLevel": "Medium",
  "chiefComplaint": "Intermittent chest pain worsening with exertion",
  "suggestedQuestions": [
    "When exactly does the pain start — at rest or only during activity?",
    "Do you have any history of heart disease or high blood pressure?",
    "Have you experienced shortness of breath or dizziness alongside the pain?"
  ]
}
```

### Post-visit Summary (called after doctor submits notes)

```
Convert these clinical notes into a patient-friendly summary. Return a JSON object with EXACTLY these fields:
- summary: string (1-2 paragraphs, plain language, no medical jargon)
- medicationSchedule: array of {drug, dosage, timesPerDay, durationDays}
- followUpSteps: array of strings describing next steps for the patient

Clinical notes: <doctor notes here>
Prescription: <prescription JSON here>

Respond with valid JSON only.
```

**Response schema:**
```json
{
  "summary": "Your doctor found that your chest pain is likely related to mild acid reflux...",
  "medicationSchedule": [
    { "drug": "Omeprazole", "dosage": "20mg", "timesPerDay": 1, "durationDays": 14 }
  ],
  "followUpSteps": [
    "Avoid spicy foods and large meals before bed",
    "Return if pain worsens or new symptoms appear",
    "Follow-up appointment in 2 weeks"
  ]
}
```

**Failure handling:** All LLM calls are wrapped in try/catch with a 30s timeout and 2 retry attempts. On failure, `llmStatus` is set to `FAILED` and the UI shows "AI summary unavailable — please review raw symptoms/notes below." Booking and visit workflows are **never blocked** by LLM availability.

---

## Google Calendar OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the **Google Calendar API**: APIs & Services → Library → search "Google Calendar API" → Enable
4. Create OAuth 2.0 credentials: APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:5000/api/calendar/oauth/callback` (dev) and your production URL
5. Copy **Client ID** and **Client Secret** to `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/calendar/oauth/callback
   ```
6. Configure OAuth consent screen: APIs & Services → OAuth consent screen
   - User type: External
   - Add test users (email addresses)
   - Add scope: `https://www.googleapis.com/auth/calendar.events`
7. In the app, patients and doctors each independently connect their calendar via Settings → "Connect Google Calendar"

---

## Deployment

### Backend → Render

1. Push the repo to GitHub
2. Go to [render.com](https://render.com), create account
3. New → Blueprint → connect your repo → select `healthcare/render.yaml`
4. Render auto-provisions PostgreSQL and the Node.js service
5. After deploy, run the seed: Render Dashboard → healthcare-api → Shell → `npm run db:seed`
6. Set optional env vars (ANTHROPIC_API_KEY, SMTP credentials, Google OAuth) in Render Dashboard

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com), connect your GitHub repo
2. Configure:
   - Root directory: `healthcare`
   - Build command: `cd apps/web && npm install && npm run build`
   - Output directory: `apps/web/dist`
3. Add environment variable: `VITE_API_URL` = your Render API URL (e.g. `https://healthcare-api.onrender.com/api`)
4. Deploy

---

## Background Jobs

Jobs run on startup via `node-cron` (no Redis required):

| Job | Schedule | Purpose |
|---|---|---|
| `hold-expiry-sweeper` | Every 2 min | Release expired HELD slots |
| `notification-retry` | Every 5 min | Retry FAILED notifications with exponential backoff |

Both implement the `IJobQueue` interface — swap to BullMQ by implementing `BullMQQueue` and setting `JOB_QUEUE_DRIVER=bullmq` env var (requires Redis).
=======
# Vitalis
>>>>>>> 5655e6d331ca6680d309b299252b68df7b6684d2
