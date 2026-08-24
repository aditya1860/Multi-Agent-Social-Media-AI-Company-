import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import PatientDashboardPage from './pages/patient/DashboardPage';
import DoctorsPage from './pages/patient/DoctorsPage';
import BookAppointmentPage from './pages/patient/BookAppointmentPage';
import SymptomFormPage from './pages/patient/SymptomFormPage';
import AppointmentsListPage from './pages/patient/AppointmentsListPage';
import AppointmentDetailPage from './pages/patient/AppointmentDetailPage';
import DoctorDashboardPage from './pages/doctor/DoctorDashboardPage';
import DoctorSchedulePage from './pages/doctor/DoctorSchedulePage';
import PostVisitNotesPage from './pages/doctor/PostVisitNotesPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminDoctorsPage from './pages/admin/AdminDoctorsPage';
import AdminAppointmentsPage from './pages/admin/AdminAppointmentsPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';
import ProfilePage from './pages/ProfilePage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function DashboardRedirect() {
  const { user } = useAuth();
  if (user?.role === 'DOCTOR') return <Navigate to="/dashboard" replace />;
  if (user?.role === 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (user?.role === 'DOCTOR') return <DoctorDashboardPage />;
  if (user?.role === 'ADMIN') return <AdminDashboardPage />;
  return <PatientDashboardPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<RequireAuth><DashboardRouter /></RequireAuth>} />
            <Route path="/schedule" element={<RequireAuth><DoctorSchedulePage /></RequireAuth>} />
            <Route path="/doctors" element={<RequireAuth><DoctorsPage /></RequireAuth>} />
            <Route path="/doctors/:doctorId/book" element={<RequireAuth><BookAppointmentPage /></RequireAuth>} />
            <Route path="/appointments" element={<RequireAuth><AppointmentsListPage /></RequireAuth>} />
            <Route path="/appointments/:appointmentId" element={<RequireAuth><AppointmentDetailPage /></RequireAuth>} />
            <Route path="/appointments/:appointmentId/symptoms" element={<RequireAuth><SymptomFormPage /></RequireAuth>} />
            <Route path="/appointments/:appointmentId/notes" element={<RequireAuth><PostVisitNotesPage /></RequireAuth>} />
            <Route path="/admin/doctors" element={<RequireAuth><AdminDoctorsPage /></RequireAuth>} />
            <Route path="/admin/appointments" element={<RequireAuth><AdminAppointmentsPage /></RequireAuth>} />
            <Route path="/admin/notifications" element={<RequireAuth><AdminNotificationsPage /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
