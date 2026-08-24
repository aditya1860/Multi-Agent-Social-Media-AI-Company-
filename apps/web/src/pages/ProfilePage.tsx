import React from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../lib/auth';
import { User } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <AppLayout>
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Profile</h1>
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6FE0D0] to-[#1F9E93] flex items-center justify-center text-white text-2xl font-bold">
              {user?.name?.[0]}
            </div>
            <div>
              <p className="font-bold text-slate-800 text-lg">{user?.name}</p>
              <p className="text-slate-500 text-sm capitalize">{user?.role?.toLowerCase()}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-white/40">
              <span className="text-slate-500">Email</span>
              <span className="text-slate-700 font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">Role</span>
              <span className="text-primary-500 font-medium capitalize">{user?.role?.toLowerCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
