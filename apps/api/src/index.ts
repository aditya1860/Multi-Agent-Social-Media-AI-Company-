import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import { env } from './config/env';
import { jobQueue } from './services/queue';
import { releaseExpiredHolds } from './jobs/holdExpiry';
import { retryFailedNotifications } from './jobs/notificationRetry';

import authRoutes from './routes/auth';
import doctorRoutes from './routes/doctors';
import appointmentRoutes from './routes/appointments';
import symptomRoutes from './routes/symptoms';
import postVisitRoutes from './routes/postVisit';
import adminRoutes from './routes/admin';
import calendarRoutes from './routes/calendar';

const app = express();

// Allow all localhost origins for development, or the specific FRONTEND_URL for production
const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/appointments', symptomRoutes);
app.use('/api/appointments', postVisitRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/calendar', calendarRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
});

async function bootstrap() {
  await connectDB();

  // Register background jobs
  jobQueue.register({
    name: 'hold-expiry-sweeper',
    schedule: '*/2 * * * *', // every 2 minutes
    handler: releaseExpiredHolds,
  });
  jobQueue.register({
    name: 'notification-retry',
    schedule: '*/5 * * * *', // every 5 minutes
    handler: retryFailedNotifications,
  });
  jobQueue.start();

  app.listen(parseInt(env.PORT), () => {
    console.log(`✅ Vitalis API running on port ${env.PORT}`);
    console.log(`   Frontend URL: ${env.FRONTEND_URL}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
  });
}

bootstrap().catch(err => {
  console.error('Bootstrap failure:', err);
  process.exit(1);
});
