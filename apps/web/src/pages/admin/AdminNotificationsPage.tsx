import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../../components/layout/AppLayout';
import { api } from '../../lib/api';
import { motion } from 'framer-motion';

const statusColors: Record<string, string> = {
  SENT: 'text-green-600 bg-green-50',
  PENDING: 'text-amber-600 bg-amber-50',
  FAILED: 'text-red-600 bg-red-50',
  ABANDONED: 'text-slate-600 bg-slate-100',
};

export default function AdminNotificationsPage() {
  const { data: logs = [] } = useQuery({ queryKey: ['admin', 'notifications'], queryFn: () => api.get('/admin/notifications').then(r => r.data) });
  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Notification Log</h1>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/40">
              <th className="text-left px-5 py-3 text-slate-500 font-semibold">Type</th>
              <th className="text-left px-5 py-3 text-slate-500 font-semibold">Channel</th>
              <th className="text-left px-5 py-3 text-slate-500 font-semibold">Status</th>
              <th className="text-left px-5 py-3 text-slate-500 font-semibold">Attempts</th>
              <th className="text-left px-5 py-3 text-slate-500 font-semibold">Created</th>
            </tr></thead>
            <tbody>
              {logs.map((log: any, i: number) => (
                <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-white/20 hover:bg-white/30">
                  <td className="px-5 py-3">{log.type}</td>
                  <td className="px-5 py-3">{log.channel}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[log.status] || ''}`}>{log.status}</span></td>
                  <td className="px-5 py-3 tabular-nums">{log.attempts}</td>
                  <td className="px-5 py-3 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <p className="text-slate-400 text-center py-8">No notification logs yet.</p>}
        </div>
      </div>
    </AppLayout>
  );
}
