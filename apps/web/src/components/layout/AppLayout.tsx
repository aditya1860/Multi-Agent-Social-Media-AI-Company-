import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Home, User, FileText, Bell, LogOut, Stethoscope, Shield, ClipboardList } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const patientNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/doctors', label: 'Find Doctors', icon: Stethoscope },
  { href: '/appointments', label: 'My Appointments', icon: Calendar },
  { href: '/profile', label: 'Profile', icon: User },
];

const doctorNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/schedule', label: 'My Schedule', icon: Calendar },
  { href: '/appointments', label: 'Appointments', icon: ClipboardList },
  { href: '/profile', label: 'Profile', icon: User },
];

const adminNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/admin/doctors', label: 'Doctors', icon: Stethoscope },
  { href: '/admin/appointments', label: 'All Appointments', icon: Calendar },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const nav = user?.role === 'DOCTOR' ? doctorNav : user?.role === 'ADMIN' ? adminNav : patientNav;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col glass-card-lg m-4 p-6 gap-2 fixed h-[calc(100vh-2rem)]">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6FE0D0] to-[#1F9E93] flex items-center justify-center shadow-clay">
            <Stethoscope size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">Vitalis</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role?.toLowerCase()} portal</p>
          </div>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          {nav.map((item) => {
            const active = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-primary-500 text-white shadow-card'
                    : 'text-slate-600 hover:bg-white/60 hover:text-primary-600',
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/40 pt-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6FE0D0] to-[#1F9E93] flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 w-full transition-all"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      {/* Main content */}
      <main className="flex-1 md:ml-72 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
